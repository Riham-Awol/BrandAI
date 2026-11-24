import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma.js";
import { setProviderOverrides } from "@/server/ai/providers/registry.js";
import { createMockTextProvider } from "@/server/ai/providers/mock.js";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import { setIntegrationFetch } from "@/server/integrations/net-guard.js";
import { createBusiness } from "@/server/businesses/service.js";
import { getAutomationSettings, saveAutomationSettings } from "@/modules/automation/settings-service.js";
import { createIntegration, deleteIntegration, listIntegrations, testIntegration } from "@/modules/automation/integrations-service.js";
import { cancelItem, decideItem, getItem, listItems, markPosted, rescheduleItem, scheduleItem } from "@/modules/automation/queue-service.js";
import { publishNow, runAutomation } from "@/modules/automation/runner.js";
import { addContact, importContacts, listContacts, unsubscribeByToken } from "@/modules/automation/contacts-service.js";
import { createCampaign, draftCampaign, getCampaign, sendTestEmail } from "@/modules/automation/campaigns-service.js";
import { createReminder } from "@/modules/automation/reminders-service.js";
import { createRule } from "@/modules/automation/rules-service.js";
import { listHistory } from "@/modules/automation/history.js";
import { getCalendar } from "@/modules/automation/calendar-service.js";
import { contactSchema, importSchema, integrationSchema, ruleSchema, scheduleSchema, settingsSchema } from "@/modules/automation/schemas.js";
import { addMember, createUser } from "../helpers/factories.js";

let calls;
let respond;
beforeEach(() => {
  calls = [];
  respond = () => new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), { status: 200 });
  setIntegrationFetch(async (url, init) => {
    calls.push({ url: String(url), init });
    return respond(url, init);
  });
  setProviderOverrides({ text: createMockTextProvider({ responder: mockFixtureResponder }) });
});
afterEach(() => {
  setIntegrationFetch(null);
  setProviderOverrides(null);
});

const settings = (over = {}) => settingsSchema.parse({ mode: "DRAFT_ONLY", dailyPublishLimit: 10, dailyEmailLimit: 200, requireSeparateApprover: false, timezone: "Europe/London", ...over });
const past = () => new Date(Date.now() - 60000).toISOString();
const future = (h = 2) => new Date(Date.now() + h * 3600000).toISOString();

async function setup(mode = "DRAFT_ONLY", over = {}) {
  const owner = await createUser();
  const ws = owner.workspace.id;
  const biz = await createBusiness(owner.user, ws, { name: "Kirkgate Bakery", stage: "STARTING" });
  await saveAutomationSettings(owner.user, ws, settings({ mode, ...over }));
  const tg = await createIntegration(owner.user, ws, integrationSchema.parse({ type: "TELEGRAM", name: "Bakery channel", botToken: "123456789:AAEhBP0av28kqx-Ab1cDEfghIJKlmnoPqRS", chatId: "@kirkgatebakery" }));
  return { owner, ws, biz, tg };
}
const custom = (ctx, over = {}) => scheduleSchema.parse({ businessId: ctx.biz.id, sourceType: "CUSTOM", text: "Fresh rye today!", integrationId: ctx.tg.id, scheduledAt: past(), ...over });

describe("settings and permissions", () => {
  it("only the owner can switch on authorized automation", async () => {
    const owner = await createUser();
    const ws = owner.workspace.id;
    expect((await getAutomationSettings(owner.user, ws)).mode).toBe("DRAFT_ONLY");
    const admin = await createUser();
    await addMember(ws, admin.user.id, "ADMIN");
    await expect(saveAutomationSettings(admin.user, ws, settings({ mode: "AUTOMATED" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await saveAutomationSettings(admin.user, ws, settings({ mode: "APPROVAL_REQUIRED" }))).mode).toBe("APPROVAL_REQUIRED");
    const s = await saveAutomationSettings(owner.user, ws, settings({ mode: "AUTOMATED" }));
    expect(s).toMatchObject({ mode: "AUTOMATED", permissions: { canEnableAutopilot: true } });
    const editor = await createUser();
    await addMember(ws, editor.user.id, "EDITOR");
    await expect(saveAutomationSettings(editor.user, ws, settings())).rejects.toMatchObject({ code: "FORBIDDEN" });
    const history = await listHistory(owner.user, ws);
    expect(history.map((h) => h.message)).toEqual(expect.arrayContaining(["Automation mode changed from APPROVAL_REQUIRED to AUTOMATED."]));
  });
});

describe("integrations", () => {
  it("encrypts secrets, never returns them, and blocks unsafe webhook URLs", async () => {
    const ctx = await setup();
    const row = await prisma.integration.findUnique({ where: { id: ctx.tg.id } });
    expect(row.secretEncrypted).toMatch(/^v1:/);
    expect(row.secretEncrypted).not.toContain("AAEhBP0av28");
    expect(JSON.stringify(await listIntegrations(ctx.owner.user, ctx.ws))).not.toContain("AAEhBP0av28");
    const hook = await createIntegration(ctx.owner.user, ctx.ws, integrationSchema.parse({ type: "WEBHOOK", name: "Zapier", url: "https://hooks.example.com/abc" }));
    expect(hook.reveal.signingSecret).toHaveLength(32);
    expect(hook.config).toEqual({ host: "hooks.example.com" });
    for (const url of ["https://127.0.0.1/x", "https://10.0.0.5/x", "https://[::1]/x", "https://localhost/x", "https://hooks.example.com:8443/x", "https://user:pw@hooks.example.com/"]) {
      await expect(createIntegration(ctx.owner.user, ctx.ws, { type: "WEBHOOK", name: "bad", url })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    }
    expect(integrationSchema.safeParse({ type: "WEBHOOK", name: "x", url: "http://hooks.example.com" }).success).toBe(false);

    respond = () => new Response(JSON.stringify({ ok: true, result: { username: "kirkgate_bot" } }), { status: 200 });
    expect(await testIntegration(ctx.owner.user, ctx.ws, ctx.tg.id)).toEqual({ ok: true, ref: "kirkgate_bot" });
    expect(calls.at(-1).url).toBe("https://api.telegram.org/bot123456789:AAEhBP0av28kqx-Ab1cDEfghIJKlmnoPqRS/getMe");
    respond = () => new Response(JSON.stringify({ ok: false, description: "Unauthorized" }), { status: 401 });
    expect(await testIntegration(ctx.owner.user, ctx.ws, ctx.tg.id)).toMatchObject({ ok: false });
    expect((await listIntegrations(ctx.owner.user, ctx.ws)).find((i) => i.id === ctx.tg.id).status).toBe("ERROR");

    const editor = await createUser();
    await addMember(ctx.ws, editor.user.id, "EDITOR");
    await expect(createIntegration(editor.user, ctx.ws, integrationSchema.parse({ type: "WEBHOOK", name: "x", url: "https://hooks.example.com/x" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await deleteIntegration(ctx.owner.user, ctx.ws, hook.id);
    expect((await prisma.integration.findUnique({ where: { id: hook.id } })).secretEncrypted).toBe("");
  });
});

describe("the three modes", () => {
  it("draft-only never publishes: due items become 'post manually' with a reminder", async () => {
    const ctx = await setup("DRAFT_ONLY");
    const item = await scheduleItem(ctx.owner.user, ctx.ws, custom(ctx));
    expect(item.status).toBe("APPROVED");
    const summary = await runAutomation({ workspaceId: ctx.ws });
    expect(summary).toMatchObject({ manual: 1, published: 0 });
    expect(calls).toHaveLength(0);
    expect((await getItem(ctx.owner.user, ctx.ws, item.id)).status).toBe("MANUAL_DUE");
    expect(await prisma.notification.count({ where: { userId: ctx.owner.user.id, type: "automation.manual_due" } })).toBe(1);
    const posted = await markPosted(ctx.owner.user, ctx.ws, item.id, { externalUrl: "https://t.me/kirkgatebakery/1" });
    expect(posted).toMatchObject({ status: "PUBLISHED", externalUrl: "https://t.me/kirkgatebakery/1" });
  });

  it("approval-required: editors' items wait for an owner/admin; unapproved items are blocked at run time", async () => {
    const ctx = await setup("APPROVAL_REQUIRED", { requireSeparateApprover: true });
    const editor = await createUser();
    await addMember(ctx.ws, editor.user.id, "EDITOR");
    const item = await scheduleItem(editor.user, ctx.ws, custom(ctx));
    expect(item.status).toBe("PENDING_APPROVAL");
    expect(await prisma.notification.count({ where: { userId: ctx.owner.user.id, type: "automation.approval" } })).toBe(1);
    await runAutomation({ workspaceId: ctx.ws });
    expect(calls).toHaveLength(0);
    await expect(decideItem(editor.user, ctx.ws, item.id, { approve: true })).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Separate approver: the owner's own item can't be self-approved.
    const own = await scheduleItem(ctx.owner.user, ctx.ws, custom(ctx));
    expect(own.status).toBe("PENDING_APPROVAL");
    await expect(decideItem(ctx.owner.user, ctx.ws, own.id, { approve: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(publishNow(ctx.owner.user, ctx.ws, own.id)).rejects.toMatchObject({ code: "FORBIDDEN" });

    const approved = await decideItem(ctx.owner.user, ctx.ws, item.id, { approve: true, note: "Looks good" });
    expect(approved).toMatchObject({ status: "APPROVED", approvedById: ctx.owner.user.id });
    const summary = await runAutomation({ workspaceId: ctx.ws });
    expect(summary.published).toBe(1);
    expect(calls[0].url).toContain("/sendMessage");
    expect(JSON.parse(calls[0].init.body)).toEqual({ chat_id: "@kirkgatebakery", text: "Fresh rye today!" });
    expect(await getItem(ctx.owner.user, ctx.ws, item.id)).toMatchObject({ status: "PUBLISHED", externalUrl: "https://t.me/kirkgatebakery/42" });

    // Switching from automated to approval-required re-checks items approved only by policy.
    await saveAutomationSettings(ctx.owner.user, ctx.ws, settings({ mode: "AUTOMATED" }));
    const auto = await scheduleItem(editor.user, ctx.ws, custom(ctx));
    expect(auto).toMatchObject({ status: "APPROVED", approvedById: null });
    await saveAutomationSettings(ctx.owner.user, ctx.ws, settings({ mode: "APPROVAL_REQUIRED" }));
    const before = calls.length;
    await runAutomation({ workspaceId: ctx.ws });
    expect(calls.length).toBe(before);
    expect((await getItem(ctx.owner.user, ctx.ws, auto.id)).status).toBe("PENDING_APPROVAL");
    expect((await listHistory(ctx.owner.user, ctx.ws, { outcome: "BLOCKED" })).length).toBeGreaterThan(0);
  });

  it("authorized automation publishes within the daily limit, retries failures, and claims items once", async () => {
    const ctx = await setup("AUTOMATED", { dailyPublishLimit: 1 });
    const a = await scheduleItem(ctx.owner.user, ctx.ws, custom(ctx, { text: "One" }));
    const b = await scheduleItem(ctx.owner.user, ctx.ws, custom(ctx, { text: "Two" }));
    const [r1, r2] = await Promise.all([runAutomation({ workspaceId: ctx.ws }), runAutomation({ workspaceId: ctx.ws })]);
    expect([r1.skipped, r2.skipped].filter(Boolean)).toHaveLength(1); // concurrent runs are serialized
    expect((r1.published ?? 0) + (r2.published ?? 0)).toBe(1);
    expect((r1.postponed ?? 0) + (r2.postponed ?? 0)).toBe(1);
    expect(calls).toHaveLength(1);
    const items = await listItems(ctx.owner.user, ctx.ws);
    expect(items.map((i) => i.status).sort()).toEqual(["APPROVED", "PUBLISHED"]);
    expect(new Date(items.find((i) => i.status === "APPROVED").scheduledAt) > new Date()).toBe(true);

    // Failure → automatic retry, then FAILED after 3 attempts.
    await saveAutomationSettings(ctx.owner.user, ctx.ws, settings({ mode: "AUTOMATED", dailyPublishLimit: 50 }));
    respond = () => new Response(JSON.stringify({ ok: false, description: "chat not found" }), { status: 400 });
    const c = await scheduleItem(ctx.owner.user, ctx.ws, custom(ctx, { text: "Three" }));
    for (let i = 0; i < 3; i++) {
      await prisma.scheduledItem.update({ where: { id: c.id }, data: { scheduledAt: new Date(Date.now() - 1000) } });
      await runAutomation({ workspaceId: ctx.ws });
    }
    expect(await getItem(ctx.owner.user, ctx.ws, c.id)).toMatchObject({ status: "FAILED", attempts: 3, lastError: expect.stringContaining("chat not found") });
    void a;
    void b;
  });

  it("items without a channel are always posted manually; cancelled and rescheduled items follow the policy", async () => {
    const ctx = await setup("AUTOMATED");
    const manual = await scheduleItem(ctx.owner.user, ctx.ws, custom(ctx, { integrationId: null }));
    await runAutomation({ workspaceId: ctx.ws });
    expect((await getItem(ctx.owner.user, ctx.ws, manual.id)).status).toBe("MANUAL_DUE");
    const later = await scheduleItem(ctx.owner.user, ctx.ws, custom(ctx, { scheduledAt: future(5) }));
    await saveAutomationSettings(ctx.owner.user, ctx.ws, settings({ mode: "APPROVAL_REQUIRED", requireSeparateApprover: true }));
    expect((await rescheduleItem(ctx.owner.user, ctx.ws, later.id, future(6))).status).toBe("PENDING_APPROVAL");
    expect((await cancelItem(ctx.owner.user, ctx.ws, later.id)).status).toBe("CANCELLED");
    await expect(cancelItem(ctx.owner.user, ctx.ws, later.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("email campaigns and audience", () => {
  it("adds contacts only with consent, sends within the daily limit and honours unsubscribes", async () => {
    const ctx = await setup("AUTOMATED", { dailyEmailLimit: 2 });
    expect(contactSchema.safeParse({ businessId: ctx.biz.id, email: "a@example.com", consentSource: "Website form" }).success).toBe(false);
    const ann = await addContact(ctx.owner.user, ctx.ws, contactSchema.parse({ businessId: ctx.biz.id, email: "Ann@Example.com", consentSource: "Signed up in the shop", consentConfirmed: true }));
    expect(ann.email).toBe("ann@example.com");
    const imported = await importContacts(ctx.owner.user, ctx.ws, importSchema.parse({ businessId: ctx.biz.id, csv: "Email,Name\nbob@example.com,Bob\nann@example.com,Dup\nnot-an-email,X\n\"cat@example.com\",\"Cat, Jr\"\n", consentSource: "Newsletter sign-up sheet", consentConfirmed: true }));
    expect(imported).toEqual({ added: 2, skipped: 1, invalid: 1 });

    const draft = await draftCampaign(ctx.owner.user, ctx.ws, { businessId: ctx.biz.id, brief: "Rye is back" });
    expect(draft.subject).toContain("[Mock]");
    const campaign = await createCampaign(ctx.owner.user, ctx.ws, { businessId: ctx.biz.id, name: "Rye is back", subject: draft.subject, preheader: draft.preheader, content: { ...draft.content, ctaUrl: "https://kirkgate.example" } });
    expect(campaign.recipients).toBe(3);
    expect((await sendTestEmail(ctx.owner.user, ctx.ws, campaign.id)).sentTo).toBe(ctx.owner.user.email);

    const bob = await prisma.emailContact.findFirst({ where: { email: "bob@example.com" } });
    expect(await unsubscribeByToken(bob.unsubscribeToken)).toEqual({ businessName: "Kirkgate Bakery" });
    await expect(addContact(ctx.owner.user, ctx.ws, contactSchema.parse({ businessId: ctx.biz.id, email: "bob@example.com", consentSource: "again", consentConfirmed: true }))).rejects.toMatchObject({ code: "CONFLICT" });

    const item = await scheduleItem(ctx.owner.user, ctx.ws, scheduleSchema.parse({ businessId: ctx.biz.id, sourceType: "EMAIL_CAMPAIGN", sourceId: campaign.id, scheduledAt: past() }));
    expect((await getCampaign(ctx.owner.user, ctx.ws, campaign.id)).status).toBe("SCHEDULED");
    await runAutomation({ workspaceId: ctx.ws });
    let c = await getCampaign(ctx.owner.user, ctx.ws, campaign.id);
    expect(c).toMatchObject({ status: "SENT", sentCount: 2 });
    const deliveries = await prisma.emailDelivery.findMany({ where: { campaignId: campaign.id }, include: { contact: true } });
    expect(deliveries.map((d) => d.contact.email).sort()).toEqual(["ann@example.com", "cat@example.com"]);
    expect(deliveries.every((d) => d.status === "logged" && d.provider === "console")).toBe(true);
    expect((await getItem(ctx.owner.user, ctx.ws, item.id)).status).toBe("PUBLISHED");

    // The daily limit (2) is now used up: a second campaign is postponed, not sent.
    const second = await createCampaign(ctx.owner.user, ctx.ws, { businessId: ctx.biz.id, name: "Second", subject: "Hi", preheader: "", content: { heading: "Hi", paragraphs: ["x"], ctaLabel: "", ctaUrl: "" } });
    const item2 = await scheduleItem(ctx.owner.user, ctx.ws, scheduleSchema.parse({ businessId: ctx.biz.id, sourceType: "EMAIL_CAMPAIGN", sourceId: second.id, scheduledAt: past() }));
    await runAutomation({ workspaceId: ctx.ws });
    c = await getCampaign(ctx.owner.user, ctx.ws, second.id);
    expect(c.sentCount).toBe(0);
    expect((await getItem(ctx.owner.user, ctx.ws, item2.id)).status).toBe("APPROVED");
    expect((await listContacts(ctx.owner.user, ctx.ws, ctx.biz.id)).subscribed).toBe(2);
  });
});

describe("reminders, rules and calendar", () => {
  it("fires reminders, queues ready posts, blocks external forwarding outside automated mode", async () => {
    const ctx = await setup("DRAFT_ONLY");
    await createReminder(ctx.owner.user, ctx.ws, { title: "Order flour", dueAt: past() });
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const project = await prisma.project.create({ data: { workspaceId: ctx.ws, businessId: ctx.biz.id, type: "SOCIAL_STUDIO", name: "Plan", input: {}, createdById: ctx.owner.user.id } });
    const post = await prisma.socialPost.create({ data: { workspaceId: ctx.ws, businessId: ctx.biz.id, projectId: project.id, scheduledDate: new Date(`${tomorrow}T00:00:00Z`), platform: "INSTAGRAM", format: "POST", title: "Rye returns", status: "READY", createdById: ctx.owner.user.id, content: { hook: "h", caption: "Rye is back", hashtags: ["#rye"], callToAction: "Visit", altText: "", visualIdea: "", slides: [], frames: [], scenes: [], audio: "", promotion: { offer: "", code: "", validUntil: "", terms: "" } } } });
    await createRule(ctx.owner.user, ctx.ws, ruleSchema.parse({ template: "queue_ready_posts", name: "Queue ready posts", integrationId: ctx.tg.id, time: "10:30" }));
    const hook = await createIntegration(ctx.owner.user, ctx.ws, integrationSchema.parse({ type: "WEBHOOK", name: "CRM", url: "https://hooks.example.com/crm" }));
    const fwd = await createRule(ctx.owner.user, ctx.ws, ruleSchema.parse({ template: "forward_website_messages", name: "Forward messages", integrationId: hook.id }));
    await expect(createRule(ctx.owner.user, ctx.ws, ruleSchema.parse({ template: "forward_website_messages", name: "x", integrationId: ctx.tg.id }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const site = await prisma.website.create({ data: { workspaceId: ctx.ws, businessId: ctx.biz.id, type: "BUSINESS", name: "Site", slug: `s-${Date.now()}`, config: {}, createdById: ctx.owner.user.id } });
    await prisma.websiteSubmission.create({ data: { websiteId: site.id, workspaceId: ctx.ws, kind: "contact", name: "Ann", email: "ann@example.com", message: "Hi", pagePath: "/", ipHash: "x".repeat(64), createdAt: new Date(Date.now() + 1000) } });
    await prisma.automationRule.update({ where: { id: fwd.id }, data: { lastRunAt: new Date(Date.now() - 5000) } });

    const summary = await runAutomation({ workspaceId: ctx.ws, now: new Date(Date.now() + 2000) });
    expect(summary.reminders).toBe(1);
    expect(await prisma.notification.count({ where: { userId: ctx.owner.user.id, type: "reminder", title: "Order flour" } })).toBe(1);
    const queued = await prisma.scheduledItem.findFirst({ where: { sourceId: post.id } });
    expect(queued).toMatchObject({ status: "APPROVED", sourceType: "SOCIAL_POST", integrationId: ctx.tg.id });
    expect(queued.content.text).toBe("Rye is back\n\nVisit\n\n#rye");
    expect(calls).toHaveLength(0); // draft-only: no external calls, the forwarding rule is blocked
    const blocked = await listHistory(ctx.owner.user, ctx.ws, { outcome: "BLOCKED" });
    expect(blocked.map((b) => b.message).join(" ")).toContain("needs Authorized automation mode");

    // Second run doesn't queue the post twice.
    await runAutomation({ workspaceId: ctx.ws, now: new Date(Date.now() + 3000) });
    expect(await prisma.scheduledItem.count({ where: { sourceId: post.id } })).toBe(1);

    const cal = await getCalendar(ctx.owner.user, ctx.ws, { from: new Date(Date.now() - 86400000).toISOString(), to: new Date(Date.now() + 3 * 86400000).toISOString() });
    const kinds = cal.events.map((e) => e.kind);
    expect(kinds).toContain("scheduled");
    expect(kinds).toContain("reminder");
    expect(cal.events.find((e) => e.title === "Rye returns" && e.kind === "post")).toBeUndefined(); // scheduled posts aren't shown twice
  });
});

describe("isolation", () => {
  it("keeps queues, integrations and audiences inside their workspace", async () => {
    const ctx = await setup("AUTOMATED");
    const item = await scheduleItem(ctx.owner.user, ctx.ws, custom(ctx, { scheduledAt: future() }));
    const other = await createUser();
    await expect(getItem(other.user, other.workspace.id, item.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(publishNow(other.user, other.workspace.id, item.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(scheduleItem(other.user, other.workspace.id, custom(ctx))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(scheduleItem(ctx.owner.user, ctx.ws, custom(ctx, { integrationId: (await createIntegration(other.user, other.workspace.id, integrationSchema.parse({ type: "WEBHOOK", name: "x", url: "https://hooks.example.com/y" }))).id }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await listIntegrations(other.user, other.workspace.id)).toHaveLength(1);
    await expect(listContacts(other.user, other.workspace.id, ctx.biz.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const viewer = await createUser();
    await addMember(ctx.ws, viewer.user.id, "VIEWER");
    expect((await getItem(viewer.user, ctx.ws, item.id)).permissions).toEqual({ canEdit: false, canApprove: false });
    await expect(scheduleItem(viewer.user, ctx.ws, custom(ctx))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listContacts(viewer.user, ctx.ws, ctx.biz.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(cancelItem(viewer.user, ctx.ws, item.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
