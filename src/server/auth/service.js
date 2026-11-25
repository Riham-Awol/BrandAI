import "server-only";
import { prisma } from "../db/prisma.js";
import { AppError, Errors } from "../errors.js";
import { logger } from "../logger.js";
import { getEnv } from "../config/env.js";
import { recordAudit, AUDIT_ACTIONS } from "../audit/service.js";
import { sendEmail } from "../email/index.js";
import { createWorkspaceForUser } from "../workspaces/service.js";
import { hashPassword, verifyPassword, getDummyHash } from "./password.js";
import { generateToken, hashToken } from "./tokens.js";
import { consumeRecoveryCode, verifyTotp } from "./totp.js";
import { decryptSecret } from "../crypto/secrets.js";

const MAX_FAILED_LOGINS = 8;
const LOCK_MINUTES = 15;
const RESET_TOKEN_TTL_MINUTES = 30;

/** Public user shape: never includes hashes or security counters. */
export function toPublicUser(user) {
  return { id: user.id, email: user.email, name: user.name, image: user.image ?? null, emailVerified: Boolean(user.emailVerifiedAt), isPlatformAdmin: Boolean(user.isPlatformAdmin) };
}

/**
 * Registers a user and their personal workspace atomically.
 * Input must already be validated with registerSchema.
 */
export async function registerUser({ name, email, password }, request) {
  // When a platform admin closes sign-ups, only invited people can create an account.
  const signupsOpen = await prisma.platformSetting.findUnique({ where: { key: "signupsOpen" } });
  if (signupsOpen?.value === false) {
    const invited = await prisma.workspaceInvitation.count({ where: { email, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (!invited) throw Errors.forbidden("Sign-ups are closed right now. Ask for an invitation.");
  }
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw Errors.conflict("An account with this email already exists.");

  const passwordHash = await hashPassword(password);
  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name, email, passwordHash } });
      const workspace = await createWorkspaceForUser({ userId: user.id, name: `${name.split(" ")[0]}'s Workspace`, type: "PERSONAL" }, tx);
      await recordAudit({ action: AUDIT_ACTIONS.USER_REGISTERED, actorId: user.id, workspaceId: workspace.id, entityType: "user", entityId: user.id, request }, tx);
      return { user: toPublicUser(user), workspace };
    });
  } catch (error) {
    if (error?.code === "P2002") throw Errors.conflict("An account with this email already exists.");
    throw error;
  }
  // Best effort: the account works without it; settings offer a resend.
  await sendVerificationEmailTo(created.user.id).catch((error) => logger.warn("Verification email failed", { error }));
  return created;
}

async function sendVerificationEmailTo(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
  const { token, tokenHash } = generateToken();
  await prisma.authToken.create({ data: { userId, type: "EMAIL_VERIFICATION", tokenHash, expiresAt: new Date(Date.now() + 24 * 3600_000) } });
  const url = `${getEnv().APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({ to: user.email, subject: "Confirm your email for Brand AI", text: `Hi ${user.name},\n\nWelcome to Brand AI. Confirm your email address with this link (valid for 24 hours):\n${url}` });
}

/**
 * Verifies credentials with account lockout. Returns the user or null.
 * Always performs a bcrypt comparison to keep timing uniform.
 */
export async function verifyCredentials({ email, password, otp }, request) {
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));

  if (!user || user.deletedAt) return null;

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await recordAudit({ action: AUDIT_ACTIONS.USER_LOGIN_FAILED, actorId: user.id, metadata: { reason: "locked" }, request });
    return null;
  }

  if (valid && user.suspendedAt) {
    await recordAudit({ action: AUDIT_ACTIONS.USER_LOGIN_FAILED, actorId: user.id, metadata: { reason: "suspended" }, request });
    return null;
  }

  // Two-factor: the password alone is not enough. Wrong codes count as failed sign-ins (lockout applies).
  let mfaUpdate = {};
  if (valid && user.mfaEnabledAt) {
    if (!otp) throw new AppError("MFA_REQUIRED", "Enter the 6-digit code from your authenticator app.", 401);
    const step = verifyTotp(decryptSecret(user.mfaSecret), otp, { lastStep: user.mfaLastStep });
    if (step != null) mfaUpdate = { mfaLastStep: step };
    else {
      const remaining = consumeRecoveryCode(user.mfaRecoveryCodes, otp);
      if (remaining) {
        mfaUpdate = { mfaRecoveryCodes: remaining };
        await recordAudit({ action: AUDIT_ACTIONS.MFA_RECOVERY_USED, actorId: user.id, metadata: { remaining: remaining.length }, request });
      }
    }
    if (!Object.keys(mfaUpdate).length) {
      await registerFailure(user, request, { reason: "mfa" });
      throw new AppError("MFA_INVALID", "That code didn't work. Try the current code or a recovery code.", 401);
    }
  }

  if (!valid) {
    await registerFailure(user, request);
    return null;
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date(), ...mfaUpdate } });
  await recordAudit({ action: AUDIT_ACTIONS.USER_LOGIN, actorId: user.id, request });
  return user;
}

async function registerFailure(user, request, metadata) {
  const failed = user.failedLoginCount + 1;
  const lock = failed >= MAX_FAILED_LOGINS;
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
  });
  await recordAudit({ action: lock ? AUDIT_ACTIONS.USER_LOCKED : AUDIT_ACTIONS.USER_LOGIN_FAILED, actorId: user.id, metadata, request });
}

/**
 * Starts password recovery. Always resolves the same way whether or not the
 * email exists, so the endpoint cannot be used to enumerate accounts.
 */
export async function requestPasswordReset({ email }, request) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, deletedAt: true } });
  if (!user || user.deletedAt) return;

  const { token, tokenHash } = generateToken();
  await prisma.$transaction([
    prisma.authToken.updateMany({ where: { userId: user.id, type: "PASSWORD_RESET", usedAt: null }, data: { usedAt: new Date() } }),
    prisma.authToken.create({
      data: { userId: user.id, type: "PASSWORD_RESET", tokenHash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000) },
    }),
  ]);

  const resetUrl = `${getEnv().APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  try {
    await sendEmail({
      to: user.email,
      subject: "Reset your Brand AI password",
      text: `Hi ${user.name},\n\nUse this link to reset your password. It expires in ${RESET_TOKEN_TTL_MINUTES} minutes:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    });
  } catch (error) {
    logger.error("Password reset email failed", { userId: user.id, error });
  }
  await recordAudit({ action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED, actorId: user.id, request });
}

/** Completes password recovery and invalidates all existing sessions. */
export async function resetPassword({ token, password }, request) {
  const tokenHash = hashToken(token);
  const record = await prisma.authToken.findUnique({ where: { tokenHash } });
  if (!record || record.type !== "PASSWORD_RESET" || record.usedAt || record.expiresAt <= new Date()) {
    throw Errors.validation({ token: ["This reset link is invalid or has expired."] }, "This reset link is invalid or has expired.");
  }
  const passwordHash = await hashPassword(password);
  // Mark used with a conditional update so a token can only be consumed once.
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.authToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
    if (consumed.count !== 1) throw Errors.validation({ token: ["This reset link has already been used."] });
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, sessionVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null },
    });
  });
  await recordAudit({ action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED, actorId: record.userId, request });
}
