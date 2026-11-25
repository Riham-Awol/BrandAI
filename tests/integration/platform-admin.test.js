import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma.js";
import { setProviderOverrides } from "@/server/ai/providers/registry.js";
import { createMockTextProvider } from "@/server/ai/providers/mock.js";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import { generateText } from "@/server/ai/orchestrator.js";
import { registerUser, verifyCredentials } from "@/server/auth/service.js";
import { getAiAdministration, getPlatformOverview, grantCredits, listPlatformAudit, listUsers, listWorkspaces, requirePlatformAdmin, setAiPaused, setSignupsOpen, setUserSuspended, setWorkspacePlan, setWorkspaceSuspended, testAi } from "@/server/platform/admin-service.js";
import { getCreditStatus } from "@/server/billing/entitlements.js";
import { getBilling } from "@/server/billing/service.js";
import { createWorkspace, inviteMember } from "@/server/workspaces/team-service.js";
import { setEmailTransport } from "@/server/email/index.js";
import { createUser, setPlan } from "../helpers/factories.js";

const req = { ip: "127.0.0.1", userAgent: "vitest" };
beforeEach(() => {
  setProviderOverrides({ text: createMockTextProvider({ responder: mockFixtureResponder }) });
  setEmailTransport(async () => {});
});
afterEach(() => {
  setProviderOverrides(null);
  setEmailTransport(null);
});

async function admin({ mfa = true } = {}) {
  const a = await createUser();
  await prisma.user.update({ where: { id: a.user.id }, data: { isPlatformAdmin: true, mfaEnabledAt: mfa ? new Date() : null } });
  return a;
}

describe("platform admin access", () => {
  it("is invisible to everyone else and needs two-factor sign-in", async () => {
    const normal = await createUser();
    await expect(getPlatformOverview(normal.user)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(listUsers(normal.user)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const noMfa = await admin({ mfa: false });
    await expect(requirePlatformAdmin(noMfa.user)).rejects.toMatchObject({ code: "MFA_REQUIRED" });
    const a = await admin();
    await expect(requirePlatformAdmin(a.user)).resolves.toBeTruthy();
    // The flag is re-read from the database: revoking takes effect immediately.
    await prisma.user.update({ where: { id: a.user.id }, data: { isPlatformAdmin: false } });
    await expect(getPlatformOverview(a.user)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("platform admin actions", () => {
  it("overview counts, searching, suspending accounts", async () => {
    const a = await admin();
    const target = await createUser({ email: "target@example.com" });
    await setPlan(target.workspace.id, "PRO");
    const o = await getPlatformOverview(a.user);
    expect(o.users.total).toBeGreaterThanOrEqual(2);
    expect(o.plans.PRO).toBe(1);
    expect(o.mrrCents).toBe(0); // admin-assigned plans aren't revenue
    expect((await listUsers(a.user, { q: "target@" })).map((u) => u.email)).toEqual(["target@example.com"]);

    await expect(setUserSuspended(a.user, a.user.id, { suspended: true }, req)).rejects.toMatchObject({ code: "CONFLICT" });
    await setUserSuspended(a.user, target.user.id, { suspended: true, reason: "abuse report" }, req);
    expect(await verifyCredentials({ email: target.email, password: target.password }, req)).toBeNull();
    await setUserSuspended(a.user, target.user.id, { suspended: false }, req);
    expect((await verifyCredentials({ email: target.email, password: target.password }, req))?.id).toBe(target.user.id);
    const audit = await listPlatformAudit(a.user, { action: "platform.user_" });
    expect(audit.entries.map((e) => e.action)).toEqual(["platform.user_restored", "platform.user_suspended"]);
    expect(audit.entries[1].metadata).toEqual({ reason: "abuse report" });
  });

  it("sets plans, grants credits and suspends workspaces", async () => {
    const a = await admin();
    const owner = await createUser();
    const ws = owner.workspace.id;
    expect((await listWorkspaces(a.user, { q: ws }))[0]).toMatchObject({ id: ws, plan: "FREE" });
    await setWorkspacePlan(a.user, ws, { plan: "PRO", note: "partner" }, req);
    expect(await getBilling(owner.user, ws)).toMatchObject({ plan: "PRO", source: "ADMIN" });
    expect((await getCreditStatus(ws)).allowance).toBe(1000);
    expect(await grantCredits(a.user, ws, { amount: 50, note: "Sorry for the outage" }, req)).toMatchObject({ extra: 50 });
    await expect(grantCredits(a.user, ws, { amount: -60, note: "correction" }, req)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await setWorkspaceSuspended(a.user, ws, { suspended: true }, req);
    await expect(getBilling(owner.user, ws)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await setWorkspaceSuspended(a.user, ws, { suspended: false }, req);
    await expect(getBilling(owner.user, ws)).resolves.toBeTruthy();
    // Paying Stripe customers are changed in Stripe, not here.
    await prisma.subscription.update({ where: { workspaceId: ws }, data: { source: "STRIPE", stripeSubscriptionId: "sub_live", status: "ACTIVE" } });
    await expect(setWorkspacePlan(a.user, ws, { plan: "FREE" }, req)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("pauses AI platform-wide, reports configuration without secrets, and runs a health check", async () => {
    const a = await admin();
    const owner = await createUser();
    const ai = await getAiAdministration(a.user);
    expect(ai.providers.find((p) => p.key === "gemini")).toHaveProperty("keyConfigured");
    expect(JSON.stringify(ai)).not.toMatch(/sk_|AIza|whsec_/);
    expect(await testAi(a.user, req)).toMatchObject({ ok: true, isMock: true, reply: "OK" });

    await setAiPaused(a.user, { paused: true, message: "Back at 3pm" }, req);
    await expect(generateText({ user: owner.user, workspaceId: owner.workspace.id, module: "t", task: "t", input: "x" })).rejects.toMatchObject({ code: "AI_PAUSED", status: 503, message: "Back at 3pm" });
    await setAiPaused(a.user, { paused: false }, req);
    await expect(generateText({ user: owner.user, workspaceId: owner.workspace.id, module: "t", task: "t", input: "x" })).resolves.toBeTruthy();
  });

  it("closing sign-ups still lets invited people register", async () => {
    const a = await admin();
    await setSignupsOpen(a.user, { open: false }, req);
    await expect(registerUser({ name: "New", email: "new@example.com", password: "valid-pass-1" }, req)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const owner = await createUser().catch(() => null);
    expect(owner).toBeNull(); // the factory registers too
    await setSignupsOpen(a.user, { open: true }, req);
    const o = await createUser();
    const team = await createWorkspace(o.user, { name: "Team", type: "TEAM" }, req);
    await setSignupsOpen(a.user, { open: false }, req);
    await inviteMember(o.user, team.id, { email: "invited@example.com", role: "EDITOR" }, req);
    await expect(registerUser({ name: "Inv", email: "invited@example.com", password: "valid-pass-1" }, req)).resolves.toBeTruthy();
  });
});
