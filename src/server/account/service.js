import "server-only";
import QRCode from "qrcode";
import { prisma } from "../db/prisma.js";
import { AppError, Errors } from "../errors.js";
import { logger } from "../logger.js";
import { getEnv } from "../config/env.js";
import { recordAudit, AUDIT_ACTIONS } from "../audit/service.js";
import { sendEmail } from "../email/index.js";
import { enforceRateLimit } from "../rate-limit/index.js";
import { decryptSecret, encryptSecret, encryptionConfigured } from "../crypto/secrets.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { generateToken, hashToken } from "../auth/tokens.js";
import { cancelSubscriptionFor } from "../billing/service.js";
import { consumeRecoveryCode, generateRecoveryCodes, generateTotpSecret, otpauthUri, verifyTotp } from "../auth/totp.js";

const VERIFY_TTL_HOURS = 24;

async function loadUser(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || u.deletedAt) throw Errors.unauthenticated();
  return u;
}

/** The signed-in person's account and security status (no secrets). */
export async function getAccount(user) {
  const u = await loadUser(user.id);
  return {
    id: u.id, name: u.name, email: u.email, emailVerified: Boolean(u.emailVerifiedAt),
    mfaEnabled: Boolean(u.mfaEnabledAt), recoveryCodesLeft: Array.isArray(u.mfaRecoveryCodes) ? u.mfaRecoveryCodes.length : 0,
    lastLoginAt: u.lastLoginAt, createdAt: u.createdAt, mfaAvailable: encryptionConfigured(),
  };
}

export async function updateProfile(user, { name }, request) {
  await prisma.user.update({ where: { id: user.id }, data: { name } });
  await recordAudit({ action: AUDIT_ACTIONS.PROFILE_UPDATED, actorId: user.id, entityType: "user", entityId: user.id, request });
  return getAccount(user);
}

async function checkPassword(u, password) {
  if (!u.passwordHash || !(await verifyPassword(password, u.passwordHash))) {
    throw Errors.validation({ currentPassword: ["That password isn't right."], password: ["That password isn't right."] }, "That password isn't right.");
  }
}

/** Changes the password and signs out every session (including this one). */
export async function changePassword(user, { currentPassword, newPassword }, request) {
  await enforceRateLimit("passwordReset", `user:${user.id}`);
  const u = await loadUser(user.id);
  await checkPassword(u, currentPassword);
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(newPassword), sessionVersion: { increment: 1 } } });
  await recordAudit({ action: AUDIT_ACTIONS.PASSWORD_CHANGED, actorId: u.id, entityType: "user", entityId: u.id, request });
  await sendEmail({ to: u.email, subject: "Your Brand AI password was changed", text: `Hi ${u.name},\n\nYour password was just changed and every device was signed out. If this wasn't you, reset your password now: ${getEnv().APP_URL}/forgot-password` }).catch((error) => logger.warn("Password change email failed", { error }));
  return { signedOut: true };
}

/** "Sign out everywhere": invalidates every session, including the current one. */
export async function revokeAllSessions(user, request) {
  await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  await recordAudit({ action: AUDIT_ACTIONS.SESSIONS_REVOKED, actorId: user.id, entityType: "user", entityId: user.id, request });
  return { signedOut: true };
}

export async function sendVerificationEmail(user, request) {
  const u = await loadUser(user.id);
  if (u.emailVerifiedAt) return { alreadyVerified: true };
  await enforceRateLimit("emailVerify", `user:${u.id}`);
  const { token, tokenHash } = generateToken();
  await prisma.$transaction([
    prisma.authToken.updateMany({ where: { userId: u.id, type: "EMAIL_VERIFICATION", usedAt: null }, data: { usedAt: new Date() } }),
    prisma.authToken.create({ data: { userId: u.id, type: "EMAIL_VERIFICATION", tokenHash, expiresAt: new Date(Date.now() + VERIFY_TTL_HOURS * 3600_000) } }),
  ]);
  const url = `${getEnv().APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({ to: u.email, subject: "Confirm your email for Brand AI", text: `Hi ${u.name},\n\nConfirm your email address with this link (valid for ${VERIFY_TTL_HOURS} hours):\n${url}\n\nIf you didn't create a Brand AI account, ignore this email.` });
  await recordAudit({ action: AUDIT_ACTIONS.EMAIL_VERIFICATION_SENT, actorId: u.id, request });
  return { sent: true };
}

/** Public: the emailed token proves ownership of the address. */
export async function verifyEmail({ token }, request) {
  const record = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.type !== "EMAIL_VERIFICATION" || record.usedAt || record.expiresAt <= new Date()) {
    throw Errors.validation({ token: ["This link is invalid or has expired."] }, "This link is invalid or has expired.");
  }
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.authToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
    if (consumed.count !== 1) throw Errors.validation({ token: ["This link has already been used."] });
    await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
  });
  await recordAudit({ action: AUDIT_ACTIONS.EMAIL_VERIFIED, actorId: record.userId, request });
  return { verified: true };
}

function requireEncryption() {
  if (!encryptionConfigured()) throw Errors.notConfigured("Two-factor sign-in (INTEGRATIONS_ENCRYPTION_KEY)");
}

/** Step 1: a new secret (stored encrypted, not yet active) and its QR code. */
export async function startMfaSetup(user) {
  requireEncryption();
  const u = await loadUser(user.id);
  if (u.mfaEnabledAt) throw Errors.conflict("Two-factor sign-in is already on.");
  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: u.id }, data: { mfaSecret: encryptSecret(secret), mfaLastStep: null } });
  const uri = otpauthUri({ secret, account: u.email });
  const svg = await QRCode.toString(uri, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#17151c", light: "#ffffff" } });
  return { secret, otpauthUri: uri, qrCode: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` };
}

/** Step 2: confirm with a code; returns the recovery codes once. */
export async function enableMfa(user, { code }, request) {
  requireEncryption();
  const u = await loadUser(user.id);
  if (u.mfaEnabledAt) throw Errors.conflict("Two-factor sign-in is already on.");
  if (!u.mfaSecret) throw Errors.validation({ code: ["Start the setup first."] });
  const step = verifyTotp(decryptSecret(u.mfaSecret), code);
  if (step == null) throw Errors.validation({ code: ["That code didn't work. Check your phone's time and try the newest code."] }, "That code didn't work.");
  const { codes, hashes } = generateRecoveryCodes();
  await prisma.user.update({ where: { id: u.id }, data: { mfaEnabledAt: new Date(), mfaLastStep: step, mfaRecoveryCodes: hashes } });
  await recordAudit({ action: AUDIT_ACTIONS.MFA_ENABLED, actorId: u.id, request });
  return { enabled: true, recoveryCodes: codes };
}

function checkSecondFactor(u, code) {
  const step = verifyTotp(decryptSecret(u.mfaSecret), code, { lastStep: u.mfaLastStep });
  if (step != null) return { mfaLastStep: step };
  const remaining = consumeRecoveryCode(u.mfaRecoveryCodes, code);
  if (remaining) return { mfaRecoveryCodes: remaining };
  throw Errors.validation({ code: ["That code didn't work."] }, "That code didn't work.");
}

export async function disableMfa(user, { password, code }, request) {
  const u = await loadUser(user.id);
  if (!u.mfaEnabledAt) return { enabled: false };
  await checkPassword(u, password);
  checkSecondFactor(u, code);
  await prisma.user.update({ where: { id: u.id }, data: { mfaEnabledAt: null, mfaSecret: null, mfaRecoveryCodes: null, mfaLastStep: null } });
  await recordAudit({ action: AUDIT_ACTIONS.MFA_DISABLED, actorId: u.id, request });
  return { enabled: false };
}

export async function regenerateRecoveryCodes(user, { code }, request) {
  const u = await loadUser(user.id);
  if (!u.mfaEnabledAt) throw Errors.conflict("Turn on two-factor sign-in first.");
  const update = checkSecondFactor(u, code);
  const { codes, hashes } = generateRecoveryCodes();
  await prisma.user.update({ where: { id: u.id }, data: { ...update, mfaRecoveryCodes: hashes } });
  await recordAudit({ action: AUDIT_ACTIONS.MFA_RECOVERY_REGENERATED, actorId: u.id, request });
  return { recoveryCodes: codes };
}

/**
 * Deletes the account: refuses while the person owns a workspace that has other
 * members (ownership must be transferred first). Owned workspaces are soft
 * deleted, the email is released, and every session ends.
 */
export async function deleteAccount(user, { password }, request) {
  const u = await loadUser(user.id);
  await checkPassword(u, password);
  const owned = await prisma.workspace.findMany({ where: { ownerId: u.id, deletedAt: null }, select: { id: true, name: true, _count: { select: { members: true } } } });
  const shared = owned.filter((w) => w._count.members > 1);
  if (shared.length) throw new AppError("CONFLICT", `Transfer ownership of ${shared.map((w) => `“${w.name}”`).join(", ")} or remove its members first.`, 409);
  for (const w of owned) await cancelSubscriptionFor(w.id);
  const now = new Date();
  await prisma.$transaction([
    prisma.workspace.updateMany({ where: { id: { in: owned.map((w) => w.id) } }, data: { deletedAt: now } }),
    prisma.workspaceMember.deleteMany({ where: { userId: u.id, workspaceId: { notIn: owned.map((w) => w.id) } } }),
    prisma.user.update({ where: { id: u.id }, data: { deletedAt: now, email: `deleted-${u.id}@deleted.invalid`, name: "Deleted user", passwordHash: null, mfaSecret: null, mfaRecoveryCodes: null, mfaEnabledAt: null, sessionVersion: { increment: 1 } } }),
  ]);
  await recordAudit({ action: AUDIT_ACTIONS.ACCOUNT_DELETED, actorId: u.id, entityType: "user", entityId: u.id, metadata: { workspaces: owned.length }, request });
  return { deleted: true };
}
