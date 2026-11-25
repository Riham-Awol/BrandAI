import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma.js";
import { registerUser, requestPasswordReset, resetPassword, verifyCredentials } from "@/server/auth/service.js";
import { generateToken } from "@/server/auth/tokens.js";
import { createUser } from "../helpers/factories.js";

const req = { ip: "127.0.0.1", userAgent: "vitest" };

describe("registration", () => {
  it("creates the user, a personal workspace, OWNER membership, default limits and an audit entry", async () => {
    const { user, workspace } = await registerUser({ name: "Ada Lovelace", email: "ada@example.com", password: "analytical-1" }, req);
    expect(user).not.toHaveProperty("passwordHash");

    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(stored.passwordHash).not.toContain("analytical-1");

    const member = await prisma.workspaceMember.findFirst({ where: { userId: user.id } });
    expect(member).toMatchObject({ workspaceId: workspace.id, role: "OWNER" });
    expect(await prisma.usageLimit.count({ where: { workspaceId: workspace.id } })).toBe(4);
    expect(await prisma.auditLog.count({ where: { actorId: user.id, action: "user.registered" } })).toBe(1);
  });

  it("rejects duplicate emails", async () => {
    await createUser({ email: "dup@example.com" });
    await expect(createUser({ email: "dup@example.com" })).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });
});

describe("credential verification", () => {
  it("accepts the right password and rejects wrong ones and unknown emails", async () => {
    const { email, password } = await createUser();
    expect((await verifyCredentials({ email, password }, req))?.email).toBe(email);
    expect(await verifyCredentials({ email, password: "wrong-password-1" }, req)).toBeNull();
    expect(await verifyCredentials({ email: "nobody@example.com", password }, req)).toBeNull();
  });

  it("locks the account after repeated failures, even for the right password", async () => {
    const { email, password, user } = await createUser();
    for (let i = 0; i < 8; i++) await verifyCredentials({ email, password: "wrong-password-1" }, req);
    const locked = await prisma.user.findUnique({ where: { id: user.id } });
    expect(locked.lockedUntil.getTime()).toBeGreaterThan(Date.now());
    expect(await verifyCredentials({ email, password }, req)).toBeNull();
  });
});

describe("password recovery", () => {
  it("does nothing observable for unknown emails", async () => {
    await expect(requestPasswordReset({ email: "ghost@example.com" }, req)).resolves.toBeUndefined();
    expect(await prisma.authToken.count()).toBe(0);
  });

  it("issues a hashed single-use token, resets the password and revokes sessions", async () => {
    const { user, email } = await createUser();
    await requestPasswordReset({ email }, req);
    const tokenRow = await prisma.authToken.findFirst({ where: { userId: user.id } });
    expect(tokenRow.tokenHash).toMatch(/^[a-f0-9]{64}$/);

    // The plain token is only emailed; simulate it by issuing a known one.
    const { token, tokenHash } = generateToken();
    await prisma.authToken.update({ where: { id: tokenRow.id }, data: { tokenHash } });

    await resetPassword({ token, password: "brand-new-pass-2" }, req);
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after.sessionVersion).toBe(1);
    expect(await verifyCredentials({ email, password: "brand-new-pass-2" }, req)).not.toBeNull();

    await expect(resetPassword({ token, password: "another-pass-3" }, req)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects expired tokens", async () => {
    const { user } = await createUser();
    const { token, tokenHash } = generateToken();
    await prisma.authToken.create({ data: { userId: user.id, type: "PASSWORD_RESET", tokenHash, expiresAt: new Date(Date.now() - 1000) } });
    await expect(resetPassword({ token, password: "brand-new-pass-2" }, req)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("invalidates older tokens when a new one is requested", async () => {
    const { user, email } = await createUser();
    await requestPasswordReset({ email }, req);
    await requestPasswordReset({ email }, req);
    expect(await prisma.authToken.count({ where: { userId: user.id, type: "PASSWORD_RESET", usedAt: null } })).toBe(1);
  });
});
