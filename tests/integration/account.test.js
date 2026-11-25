import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma.js";
import { setEmailTransport } from "@/server/email/index.js";
import { verifyCredentials } from "@/server/auth/service.js";
import { totpAt, currentStep } from "@/server/auth/totp.js";
import { changePassword, deleteAccount, disableMfa, enableMfa, getAccount, regenerateRecoveryCodes, revokeAllSessions, sendVerificationEmail, startMfaSetup, updateProfile, verifyEmail } from "@/server/account/service.js";
import { addMember, createUser } from "../helpers/factories.js";

const req = { ip: "127.0.0.1", userAgent: "vitest" };
let outbox;
beforeEach(() => {
  outbox = [];
  setEmailTransport(async (m) => outbox.push(m));
});
afterEach(() => setEmailTransport(null));

const tokenFrom = (m) => decodeURIComponent(m.text.match(/token=([^\s]+)/)[1]);

describe("profile, email verification and sessions", () => {
  it("sends a confirmation link at sign-up and confirms the address once", async () => {
    const { user, email } = await createUser();
    const mail = outbox.find((m) => m.to === email);
    expect(mail.subject).toMatch(/Confirm your email/);
    expect((await getAccount(user)).emailVerified).toBe(false);
    await expect(verifyEmail({ token: "x".repeat(40) }, req)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await verifyEmail({ token: tokenFrom(mail) }, req)).toEqual({ verified: true });
    await expect(verifyEmail({ token: tokenFrom(mail) }, req)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect((await getAccount(user)).emailVerified).toBe(true);
    expect(await sendVerificationEmail(user, req)).toEqual({ alreadyVerified: true });
  });

  it("a resent link replaces the previous one", async () => {
    const { user } = await createUser();
    const first = tokenFrom(outbox.at(-1));
    await sendVerificationEmail(user, req);
    await expect(verifyEmail({ token: first }, req)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await verifyEmail({ token: tokenFrom(outbox.at(-1)) }, req)).toEqual({ verified: true });
  });

  it("updates the name; password change needs the current password and revokes sessions", async () => {
    const { user, email, password } = await createUser();
    expect((await updateProfile(user, { name: "Ada L." }, req)).name).toBe("Ada L.");
    const before = (await prisma.user.findUnique({ where: { id: user.id } })).sessionVersion;
    await expect(changePassword(user, { currentPassword: "wrong-pass-1", newPassword: "another-pass-2" }, req)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await changePassword(user, { currentPassword: password, newPassword: "another-pass-2" }, req);
    expect((await prisma.user.findUnique({ where: { id: user.id } })).sessionVersion).toBe(before + 1);
    expect(await verifyCredentials({ email, password }, req)).toBeNull();
    expect((await verifyCredentials({ email, password: "another-pass-2" }, req))?.id).toBe(user.id);
    expect(outbox.some((m) => /password was changed/.test(m.subject))).toBe(true);
    await revokeAllSessions(user, req);
    expect((await prisma.user.findUnique({ where: { id: user.id } })).sessionVersion).toBe(before + 2);
  });
});

describe("two-factor sign-in", () => {
  async function withMfa() {
    const u = await createUser();
    const setup = await startMfaSetup(u.user);
    expect(setup.qrCode).toMatch(/^data:image\/svg\+xml;base64,/);
    const stored = await prisma.user.findUnique({ where: { id: u.user.id } });
    expect(stored.mfaSecret).not.toContain(setup.secret); // encrypted at rest
    await expect(enableMfa(u.user, { code: "000000" }, req)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const { recoveryCodes } = await enableMfa(u.user, { code: totpAt(setup.secret, currentStep()) }, req);
    return { ...u, secret: setup.secret, recoveryCodes };
  }

  it("requires a valid, unused code after the password; recovery codes work once", async () => {
    const { user, email, password, secret, recoveryCodes } = await withMfa();
    expect(recoveryCodes).toHaveLength(10);
    await expect(verifyCredentials({ email, password }, req)).rejects.toMatchObject({ code: "MFA_REQUIRED" });
    // Wrong password never reveals that MFA is on.
    expect(await verifyCredentials({ email, password: "wrong-pass-1", otp: "123456" }, req)).toBeNull();
    await expect(verifyCredentials({ email, password, otp: "123456" }, req)).rejects.toMatchObject({ code: "MFA_INVALID" });
    // The code used to switch MFA on can't be replayed.
    await expect(verifyCredentials({ email, password, otp: totpAt(secret, currentStep()) }, req)).rejects.toMatchObject({ code: "MFA_INVALID" });
    expect((await verifyCredentials({ email, password, otp: totpAt(secret, currentStep() + 1) }, req))?.id).toBe(user.id);
    expect((await verifyCredentials({ email, password, otp: recoveryCodes[0] }, req))?.id).toBe(user.id);
    await expect(verifyCredentials({ email, password, otp: recoveryCodes[0] }, req)).rejects.toMatchObject({ code: "MFA_INVALID" });
    expect((await getAccount(user)).recoveryCodesLeft).toBe(9);
    expect(await prisma.auditLog.count({ where: { actorId: user.id, action: "user.mfa_recovery_used" } })).toBe(1);
  });

  it("regenerates recovery codes and turns off only with password + code", async () => {
    const { user, password, recoveryCodes } = await withMfa();
    const fresh = await regenerateRecoveryCodes(user, { code: recoveryCodes[1] }, req);
    expect(fresh.recoveryCodes).toHaveLength(10);
    await expect(disableMfa(user, { password: "wrong-pass-1", code: fresh.recoveryCodes[0] }, req)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(disableMfa(user, { password, code: recoveryCodes[2] }, req)).rejects.toMatchObject({ code: "VALIDATION_ERROR" }); // old set is gone
    expect(await disableMfa(user, { password, code: fresh.recoveryCodes[0] }, req)).toEqual({ enabled: false });
    expect((await getAccount(user)).mfaEnabled).toBe(false);
  });
});

describe("account deletion", () => {
  it("is refused while owning a workspace with other members; otherwise releases the email", async () => {
    const owner = await createUser();
    const other = await createUser();
    await addMember(owner.workspace.id, other.user.id, "EDITOR");
    await expect(deleteAccount(owner.user, { password: owner.password }, req)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(deleteAccount(other.user, { password: "wrong-pass-1" }, req)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await deleteAccount(other.user, { password: other.password }, req)).toEqual({ deleted: true });
    const gone = await prisma.user.findUnique({ where: { id: other.user.id } });
    expect(gone.deletedAt).not.toBeNull();
    expect(gone.email).toMatch(/@deleted\.invalid$/);
    expect(await prisma.workspaceMember.count({ where: { userId: other.user.id, workspaceId: owner.workspace.id } })).toBe(0);
    expect((await prisma.workspace.findUnique({ where: { id: other.workspace.id } })).deletedAt).not.toBeNull();
    // The address can be used again.
    await expect(createUser({ email: other.email })).resolves.toBeTruthy();
  });

  it("suspended accounts can't sign in", async () => {
    const { user, email, password } = await createUser();
    await prisma.user.update({ where: { id: user.id }, data: { suspendedAt: new Date() } });
    expect(await verifyCredentials({ email, password }, req)).toBeNull();
  });
});
