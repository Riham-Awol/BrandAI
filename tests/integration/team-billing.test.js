import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma.js";
import { resetEnvCache } from "@/server/config/env.js";
import { setEmailTransport } from "@/server/email/index.js";
import { setProviderOverrides } from "@/server/ai/providers/registry.js";
import { createMockTextProvider } from "@/server/ai/providers/mock.js";
import { generateText } from "@/server/ai/orchestrator.js";
import { createBusiness } from "@/server/businesses/service.js";
import { acceptInvitation, changeMemberRole, createWorkspace, getInvitation, inviteMember, leaveWorkspace, listAuditLog, listMembers, removeMember, revokeInvitation, transferOwnership } from "@/server/workspaces/team-service.js";
import { createClient, listClients, shareTeamWithClient, updateClient } from "@/server/workspaces/agency-service.js";
import { buyCredits, deleteWorkspaceWithBilling, getBilling, handleStripeWebhook, openBillingPortal, startCheckout } from "@/server/billing/service.js";
import { getCreditStatus } from "@/server/billing/entitlements.js";
import { setStripeFetch, signStripePayload } from "@/server/billing/stripe.js";
import { clientSchema } from "@/validation/team.js";
import { addMember, createUser, setPlan } from "../helpers/factories.js";

const req = { ip: "127.0.0.1", userAgent: "vitest" };
const WHSEC = "whsec_test_secret";
const ENV = { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_PRICE_PRO: "price_pro", STRIPE_PRICE_AGENCY: "price_agency", STRIPE_PRICE_CREDITS_500: "price_credits" };
let outbox;
let stripeCalls;
let stripeSubs;

beforeAll(() => {
  Object.assign(process.env, ENV);
  resetEnvCache();
});
afterAll(() => {
  for (const k of Object.keys(ENV)) delete process.env[k];
  resetEnvCache();
});
beforeEach(() => {
  outbox = [];
  stripeCalls = [];
  stripeSubs = {};
  setEmailTransport(async (m) => outbox.push(m));
  setProviderOverrides({ text: createMockTextProvider({ responder: () => ({ text: "ok" }) }) });
  // Simulated Stripe API.
  setStripeFetch(async (url, init) => {
    const path = new URL(url).pathname.replace("/v1", "");
    const body = Object.fromEntries(new URLSearchParams(init.body ?? ""));
    stripeCalls.push({ method: init.method, path, body, headers: init.headers });
    const json = (o) => new Response(JSON.stringify(o), { status: 200 });
    if (path === "/customers") return json({ id: `cus_${stripeCalls.length}` });
    if (path === "/checkout/sessions") return json({ id: `cs_${stripeCalls.length}`, url: "https://checkout.stripe.com/c/pay/cs_test" });
    if (path === "/billing_portal/sessions") return json({ url: "https://billing.stripe.com/p/session/test" });
    if (path.startsWith("/subscriptions/")) {
      const id = path.split("/")[2];
      if (init.method === "DELETE") return json({ ...stripeSubs[id], status: "canceled" });
      return json(stripeSubs[id]);
    }
    return new Response(JSON.stringify({ error: { type: "invalid_request_error" } }), { status: 400 });
  });
});
afterEach(() => {
  setEmailTransport(null);
  setStripeFetch(null);
  setProviderOverrides(null);
});

const tokenFrom = (m) => m.text.match(/\/invite\/([^\s]+)/)[1];
let eventSeq = 0;
async function webhook(type, object) {
  const raw = JSON.stringify({ id: `evt_${++eventSeq}_${Date.now()}`, type, data: { object } });
  return handleStripeWebhook(raw, signStripePayload(raw, WHSEC));
}
const sub = (workspaceId, over = {}) => ({ id: "sub_1", object: "subscription", customer: "cus_1", status: "active", cancel_at_period_end: false, metadata: { workspaceId }, items: { data: [{ price: { id: "price_pro" }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] }, ...over });

describe("team management", () => {
  async function team() {
    const owner = await createUser();
    const ws = await createWorkspace(owner.user, { name: "Kirkgate Team", type: "TEAM" }, req);
    return { owner, ws: ws.id };
  }

  it("invites by email; only the invited address can accept, once", async () => {
    const { owner, ws } = await team();
    const ann = await createUser({ email: "ann@example.com" });
    const bob = await createUser({ email: "bob@example.com" });
    const invite = await inviteMember(owner.user, ws, { email: "ann@example.com", role: "EDITOR" }, req);
    const token = tokenFrom(outbox.find((m) => m.to === "ann@example.com" && /invited you/.test(m.subject)));
    expect(await getInvitation(token)).toMatchObject({ workspace: "Kirkgate Team", role: "EDITOR", state: "pending" });
    await expect(acceptInvitation(bob.user, token, req)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await acceptInvitation(ann.user, token, req)).toMatchObject({ workspaceId: ws });
    await expect(acceptInvitation(ann.user, token, req)).rejects.toMatchObject({ code: "CONFLICT" });
    const list = await listMembers(owner.user, ws);
    expect(list.members.map((m) => [m.email, m.role])).toContainEqual(["ann@example.com", "EDITOR"]);
    expect(list.invitations).toEqual([]);
    expect((await prisma.user.findUnique({ where: { id: ann.user.id } })).emailVerifiedAt).not.toBeNull();
    expect(invite.role).toBe("EDITOR");
    await expect(inviteMember(owner.user, ws, { email: "ann@example.com", role: "VIEWER" }, req)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("enforces seats, role rules and ownership transfer", async () => {
    const { owner, ws } = await team();
    const admin = await createUser();
    await addMember(ws, admin.user.id, "ADMIN");
    // Free plan: 2 seats (owner + admin) → no more invitations.
    await expect(inviteMember(owner.user, ws, { email: "c@example.com", role: "VIEWER" }, req)).rejects.toMatchObject({ code: "PLAN_LIMIT_REACHED", status: 402 });
    await setPlan(ws, "PRO");
    // Admins can invite editors but not admins; only the owner manages admins.
    await expect(inviteMember(admin.user, ws, { email: "c@example.com", role: "ADMIN" }, req)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const inv = await inviteMember(admin.user, ws, { email: "c@example.com", role: "VIEWER" }, req);
    expect((await listMembers(owner.user, ws)).seats).toMatchObject({ used: 3, limit: 5 });
    await revokeInvitation(owner.user, ws, inv.id, req);
    await expect(getInvitation(tokenFrom(outbox.at(-1)))).resolves.toMatchObject({ state: "revoked" });

    const editor = await createUser();
    const em = await addMember(ws, editor.user.id, "EDITOR");
    const am = (await listMembers(owner.user, ws)).members.find((m) => m.userId === admin.user.id);
    await expect(changeMemberRole(admin.user, ws, em.id, { role: "ADMIN" }, req)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await changeMemberRole(admin.user, ws, em.id, { role: "VIEWER" }, req)).toMatchObject({ role: "VIEWER" });
    await expect(removeMember(admin.user, ws, am.id, req)).rejects.toMatchObject({ code: "CONFLICT" }); // self
    await expect(changeMemberRole(editor.user, ws, am.id, { role: "VIEWER" }, req)).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(transferOwnership(admin.user, ws, { memberId: am.id, password: admin.password }, req)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(transferOwnership(owner.user, ws, { memberId: am.id, password: "wrong-pass-1" }, req)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await transferOwnership(owner.user, ws, { memberId: am.id, password: owner.password }, req);
    expect((await prisma.workspace.findUnique({ where: { id: ws } })).ownerId).toBe(admin.user.id);
    expect((await listMembers(admin.user, ws)).members.find((m) => m.userId === owner.user.id).role).toBe("ADMIN");
    expect(await leaveWorkspace(owner.user, ws, req)).toEqual({ left: true });
    await expect(leaveWorkspace(admin.user, ws, req)).rejects.toMatchObject({ code: "CONFLICT" });

    const log = await listAuditLog(admin.user, ws, { action: "member." });
    expect(log.entries.map((e) => e.action)).toEqual(expect.arrayContaining(["member.invited", "member.role_changed", "member.left"]));
    await expect(listAuditLog(editor.user, ws, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("personal workspaces can't take invitations; other workspaces are invisible", async () => {
    const owner = await createUser();
    await expect(inviteMember(owner.user, owner.workspace.id, { email: "x@example.com", role: "VIEWER" }, req)).rejects.toMatchObject({ code: "CONFLICT" });
    const { ws } = await team();
    await expect(listMembers(owner.user, ws)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(listAuditLog(owner.user, ws, {})).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getBilling(owner.user, ws)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("plans and Stripe billing", () => {
  it("checkout → webhook → Pro limits; cancellation → Free; events are processed once", async () => {
    const owner = await createUser();
    const ws = owner.workspace.id;
    await createBusiness(owner.user, ws, { name: "One", stage: "STARTING" });
    await expect(createBusiness(owner.user, ws, { name: "Two", stage: "STARTING" })).rejects.toMatchObject({ code: "PLAN_LIMIT_REACHED" });

    const { url } = await startCheckout(owner.user, ws, { plan: "PRO" }, req);
    expect(url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    const session = stripeCalls.find((c) => c.path === "/checkout/sessions");
    expect(session.body).toMatchObject({ mode: "subscription", "line_items[0][price]": "price_pro", "metadata[workspaceId]": ws, client_reference_id: ws });
    expect(stripeCalls[0].headers["Idempotency-Key"]).toBe(`customer-${ws}`);
    await expect(startCheckout(owner.user, ws, { plan: "AGENCY" }, req)).rejects.toMatchObject({ code: "CONFLICT" }); // not an agency workspace

    stripeSubs.sub_1 = sub(ws);
    await webhook("checkout.session.completed", { id: "cs_1", mode: "subscription", subscription: "sub_1", customer: "cus_1", client_reference_id: ws, metadata: { workspaceId: ws } });
    let billing = await getBilling(owner.user, ws);
    expect(billing).toMatchObject({ plan: "PRO", status: "ACTIVE" });
    expect(billing.credits.allowance).toBe(1000);
    await expect(createBusiness(owner.user, ws, { name: "Two", stage: "STARTING" })).resolves.toBeTruthy();
    await expect(startCheckout(owner.user, ws, { plan: "PRO" }, req)).rejects.toMatchObject({ code: "CONFLICT" }); // already subscribed
    expect((await openBillingPortal(owner.user, ws)).url).toMatch(/^https:\/\/billing\.stripe\.com\//);

    // Replayed event id: ignored.
    const raw = JSON.stringify({ id: "evt_same", type: "customer.subscription.deleted", data: { object: sub(ws, { status: "canceled" }) } });
    expect(await handleStripeWebhook(raw, signStripePayload(raw, WHSEC))).toMatchObject({ received: true });
    expect(await handleStripeWebhook(raw, signStripePayload(raw, WHSEC))).toEqual({ duplicate: true });
    billing = await getBilling(owner.user, ws);
    expect(billing).toMatchObject({ plan: "FREE", status: "CANCELED" });
    expect(billing.credits.allowance).toBe(100);
    expect(await prisma.notification.count({ where: { userId: owner.user.id, type: "billing" } })).toBe(2);
  });

  it("rejects bad signatures and stale timestamps; non-owners can't buy", async () => {
    const owner = await createUser();
    const raw = JSON.stringify({ id: "evt_x", type: "customer.subscription.updated", data: { object: sub(owner.workspace.id) } });
    await expect(handleStripeWebhook(raw, signStripePayload(raw, "whsec_wrong"))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(handleStripeWebhook(raw, signStripePayload(raw, WHSEC, Math.floor(Date.now() / 1000) - 3600))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(handleStripeWebhook(raw, "nonsense")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect((await getBilling(owner.user, owner.workspace.id)).plan).toBe("FREE");
    const teamWs = await createWorkspace(owner.user, { name: "T", type: "TEAM" }, req);
    const admin = await createUser();
    await addMember(teamWs.id, admin.user.id, "ADMIN");
    await expect(startCheckout(admin.user, teamWs.id, { plan: "PRO" }, req)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await getBilling(admin.user, teamWs.id)).permissions.canManage).toBe(false);
  });

  it("AI credits: monthly allowance, then purchased credits, then a clear limit", async () => {
    const owner = await createUser();
    const ws = owner.workspace.id;
    await prisma.usageLimit.update({ where: { workspaceId_metric_period: { workspaceId: ws, metric: "AI_TEXT_REQUESTS", period: "MONTHLY" } }, data: { limitValue: 1n } });
    const gen = () => generateText({ user: owner.user, workspaceId: ws, module: "t", task: "t", input: "x" });
    await gen();
    await expect(gen()).rejects.toMatchObject({ code: "USAGE_LIMIT_REACHED" });

    await buyCredits(owner.user, ws, { pack: "credits_500" }, req);
    const done = { id: "cs_credits", mode: "payment", payment_status: "paid", customer: "cus_1", metadata: { workspaceId: ws, kind: "credits", pack: "credits_500" } };
    await webhook("checkout.session.completed", done);
    await webhook("checkout.session.completed", done); // a second delivery with a new event id must not double-credit
    expect((await getCreditStatus(ws)).extra).toBe(500);
    await gen();
    expect(await getCreditStatus(ws)).toMatchObject({ used: 2, extra: 499 });
  });

  it("deleting a team workspace cancels its subscription", async () => {
    const owner = await createUser();
    const teamWs = await createWorkspace(owner.user, { name: "Paid team", type: "TEAM" }, req);
    stripeSubs.sub_9 = sub(teamWs.id, { id: "sub_9" });
    await webhook("customer.subscription.created", stripeSubs.sub_9);
    await expect(deleteWorkspaceWithBilling(owner.user, teamWs.id, { confirmName: "nope" }, req)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await deleteWorkspaceWithBilling(owner.user, teamWs.id, { confirmName: "Paid team" }, req)).toEqual({ deleted: true });
    expect(stripeCalls.some((c) => c.method === "DELETE" && c.path === "/subscriptions/sub_9")).toBe(true);
    expect((await prisma.subscription.findUnique({ where: { workspaceId: teamWs.id } })).status).toBe("CANCELED");
  });
});

describe("agency clients", () => {
  it("clients get isolated workspaces that share the agency plan and credits", async () => {
    const owner = await createUser();
    const agency = (await createWorkspace(owner.user, { name: "Studio North", type: "AGENCY" }, req)).id;
    await expect(createClient(owner.user, agency, { name: "Bakery" }, req)).rejects.toMatchObject({ code: "PLAN_LIMIT_REACHED" });
    await setPlan(agency, "AGENCY");
    const editor = await createUser();
    await addMember(agency, editor.user.id, "EDITOR");
    await expect(createClient(editor.user, agency, { name: "Bakery" }, req)).rejects.toMatchObject({ code: "FORBIDDEN" });

    const c = await createClient(owner.user, agency, clientSchema.parse({ name: "Kirkgate Bakery", contactEmail: "Owner@Bakery.example" }), req);
    const list = await listClients(owner.user, agency);
    expect(list.clients[0]).toMatchObject({ name: "Kirkgate Bakery", contactEmail: "owner@bakery.example", canOpen: true, status: "ACTIVE" });
    expect(list).toMatchObject({ limit: 25, active: 1 });
    // The client workspace uses the agency plan and pooled credits.
    expect((await getBilling(owner.user, c.workspaceId)).plan).toBe("AGENCY");
    expect((await getBilling(owner.user, c.workspaceId)).isClient).toBe(true);
    await expect(startCheckout(owner.user, c.workspaceId, { plan: "PRO" }, req)).rejects.toMatchObject({ code: "CONFLICT" });
    await generateText({ user: owner.user, workspaceId: c.workspaceId, module: "t", task: "t", input: "x" });
    expect((await getCreditStatus(agency)).used).toBe(1);

    // The editor isn't in the client workspace until the team is shared.
    await expect(createBusiness(editor.user, c.workspaceId, { name: "X", stage: "STARTING" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await shareTeamWithClient(owner.user, agency, c.id, req)).toEqual({ added: 1 });
    await expect(createBusiness(editor.user, c.workspaceId, { name: "X", stage: "STARTING" })).resolves.toBeTruthy();

    // Archiving closes the client workspace.
    await updateClient(owner.user, agency, c.id, { status: "ARCHIVED" }, req);
    await expect(getBilling(owner.user, c.workspaceId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await updateClient(owner.user, agency, c.id, { status: "ACTIVE" }, req);
    await expect(getBilling(owner.user, c.workspaceId)).resolves.toBeTruthy();

    // Another agency can't see or touch these clients.
    const other = await createUser();
    const otherAgency = (await createWorkspace(other.user, { name: "Other", type: "AGENCY" }, req)).id;
    expect((await listClients(other.user, otherAgency)).clients).toEqual([]);
    await expect(updateClient(other.user, otherAgency, c.id, { notes: "x" }, req)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(listClients(other.user, agency)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(listClients(owner.user, owner.workspace.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("email bounces and complaints (Resend webhook)", () => {
  it("suppresses the address after a signed bounce; forged or unknown events change nothing", async () => {
    const { handleEmailWebhook } = await import("@/modules/automation/bounce-service.js");
    const { signSvixPayload } = await import("@/server/email/webhook.js");
    const secret = `whsec_${Buffer.from("resend-test-secret").toString("base64")}`;
    process.env.RESEND_WEBHOOK_SECRET = secret;
    resetEnvCache();
    try {
      const owner = await createUser();
      const biz = await createBusiness(owner.user, owner.workspace.id, { name: "Shop", stage: "STARTING" });
      const contact = await prisma.emailContact.create({ data: { workspaceId: owner.workspace.id, businessId: biz.id, email: "gone@example.com", consentSource: "Form", consentAt: new Date(), unsubscribeToken: "t".repeat(43) } });
      const campaign = await prisma.emailCampaign.create({ data: { workspaceId: owner.workspace.id, businessId: biz.id, name: "Launch", subject: "Hi", content: {}, status: "SENT", createdById: owner.user.id } });
      await prisma.emailDelivery.create({ data: { campaignId: campaign.id, contactId: contact.id, status: "sent", provider: "resend", providerMessageId: "re_123" } });
      const raw = JSON.stringify({ type: "email.bounced", data: { email_id: "re_123", to: ["gone@example.com"] } });
      await expect(handleEmailWebhook(raw, signSvixPayload(raw, `whsec_${Buffer.from("other").toString("base64")}`))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
      expect(await handleEmailWebhook(raw, signSvixPayload(raw, secret))).toEqual({ suppressed: "bounced" });
      expect(await handleEmailWebhook(raw, signSvixPayload(raw, secret))).toEqual({ duplicate: true });
      const c = await prisma.emailContact.findUnique({ where: { id: contact.id } });
      expect(c).toMatchObject({ suppressionReason: "bounced" });
      expect(c.unsubscribedAt).not.toBeNull();
      const unknown = JSON.stringify({ type: "email.bounced", data: { email_id: "re_unknown" } });
      expect(await handleEmailWebhook(unknown, signSvixPayload(unknown, secret))).toEqual({ ignored: true });
    } finally {
      delete process.env.RESEND_WEBHOOK_SECRET;
      Object.assign(process.env, ENV);
      resetEnvCache();
    }
  });
});
