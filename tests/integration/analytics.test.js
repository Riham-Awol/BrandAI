import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma.js";
import { getEnv } from "@/server/config/env.js";
import { setProviderOverrides } from "@/server/ai/providers/registry.js";
import { createMockTextProvider } from "@/server/ai/providers/mock.js";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import { createBusiness } from "@/server/businesses/service.js";
import { deleteReport, generateInsights, getAnalytics, getAnalyticsForExport, getAnalyticsSettings, getReport, listPostsForMetrics, listReports, saveAnalyticsSettings, savePostMetrics } from "@/modules/analytics/service.js";
import { purgeOldTracking, recordEmailEvent, recordSiteView } from "@/modules/analytics/tracking-service.js";
import { signDeliveryToken } from "@/modules/analytics/tracking.js";
import { allKpis } from "@/modules/analytics/metrics.js";
import { postMetricsSchema } from "@/modules/analytics/schemas.js";
import { addMember, createUser } from "../helpers/factories.js";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const hdrs = (ua = CHROME, extra = {}) => new Headers({ "user-agent": ua, ...extra });
const kpis = (report) => Object.fromEntries(allKpis(report).map((k) => [k.key, k.value]));

beforeEach(() => setProviderOverrides({ text: createMockTextProvider({ responder: mockFixtureResponder }) }));
afterEach(() => setProviderOverrides(null));

async function setup() {
  const owner = await createUser();
  const ws = owner.workspace.id;
  const biz = await createBusiness(owner.user, ws, { name: "Kirkgate Bakery", stage: "STARTING" });
  const slug = `kirkgate-${randomUUID().slice(0, 8)}`;
  const site = await prisma.website.create({ data: { workspaceId: ws, businessId: biz.id, type: "BUSINESS", name: "Bakery site", slug, status: "PUBLISHED", config: {}, publishedVersion: 1, publishedAt: new Date(), createdById: owner.user.id } });
  await prisma.websiteVersion.create({ data: { websiteId: site.id, version: 1, config: { pages: [{ slug: "home" }, { slug: "menu" }] }, brand: { name: "Kirkgate" }, publishedById: owner.user.id } });
  return { owner, ws, biz, site, slug };
}

async function publishedItem(ctx, over = {}) {
  return prisma.scheduledItem.create({ data: { workspaceId: ctx.ws, businessId: ctx.biz.id, title: "Rye is back", sourceType: "CUSTOM", content: { text: "Rye!" }, scheduledAt: new Date(Date.now() - 7200000), status: "PUBLISHED", publishedAt: new Date(Date.now() - 7000000), requestedById: ctx.owner.user.id, ...over } });
}

describe("website tracking", () => {
  it("records real visits only and reports visitors, pages, sources and devices", async () => {
    const ctx = await setup();
    expect(await recordSiteView(ctx.slug, { pageSlug: "home", source: "google.com", ip: "203.0.113.1", headers: hdrs() })).toBe(true);
    expect(await recordSiteView(ctx.slug, { pageSlug: "menu", source: null, ip: "203.0.113.1", headers: hdrs() })).toBe(true);
    expect(await recordSiteView(ctx.slug, { pageSlug: "home", source: null, ip: "198.51.100.7", headers: hdrs(IPHONE) })).toBe(true);
    // Ignored: bots, opted-out browsers, unknown pages, unknown sites.
    expect(await recordSiteView(ctx.slug, { pageSlug: "home", ip: "1.1.1.1", headers: hdrs("Googlebot/2.1 (+http://www.google.com/bot.html)") })).toBe(false);
    expect(await recordSiteView(ctx.slug, { pageSlug: "home", ip: "1.1.1.1", headers: hdrs(CHROME, { "sec-gpc": "1" }) })).toBe(false);
    expect(await recordSiteView(ctx.slug, { pageSlug: "secret", ip: "1.1.1.1", headers: hdrs() })).toBe(false);
    expect(await recordSiteView("no-such-site", { pageSlug: "home", ip: "1.1.1.1", headers: hdrs() })).toBe(false);

    const rows = await prisma.siteView.findMany({ where: { websiteId: ctx.site.id } });
    expect(rows).toHaveLength(3);
    expect(JSON.stringify(rows, (k, v) => (typeof v === "bigint" ? String(v) : v))).not.toContain("203.0.113.1");

    await prisma.websiteSubmission.create({ data: { websiteId: ctx.site.id, workspaceId: ctx.ws, kind: "contact", name: "A", email: "a@example.com", message: "Hi", pagePath: "/", ipHash: "x".repeat(64) } });
    const report = await getAnalytics(ctx.owner.user, ctx.ws, { days: 7 });
    expect(kpis(report)).toMatchObject({ "website.visitors": 2, "website.pageviews": 3, "website.conversions": 1, "website.conversionRate": 0.5 });
    expect(report.website.pages[0]).toEqual({ path: "home", views: 2 });
    expect(report.website.sources).toEqual(expect.arrayContaining([{ source: "google.com", views: 1 }, { source: "Direct / unknown", views: 2 }]));
    expect(report.website.devices.find((d) => d.device === "mobile").views).toBe(1);
    expect(report.website.daily).toHaveLength(7);
    expect(report.website.daily.at(-1)).toMatchObject({ visitors: 2, pageviews: 3 });
  });

  it("respects the workspace's tracking switch (admins and owner only)", async () => {
    const ctx = await setup();
    const editor = await createUser();
    await addMember(ctx.ws, editor.user.id, "EDITOR");
    const off = { trackSiteVisits: false, trackEmailEngagement: true, retentionDays: 90 };
    await expect(saveAnalyticsSettings(editor.user, ctx.ws, off)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await getAnalyticsSettings(editor.user, ctx.ws)).canManage).toBe(false);
    expect(await saveAnalyticsSettings(ctx.owner.user, ctx.ws, off)).toMatchObject({ trackSiteVisits: false, retentionDays: 90, canManage: true });
    expect(await recordSiteView(ctx.slug, { pageSlug: "home", ip: "1.1.1.1", headers: hdrs() })).toBe(false);
    const report = await getAnalytics(ctx.owner.user, ctx.ws, { days: 30 });
    expect(report.gaps[0].message).toMatch(/tracking is switched off/);
  });

  it("purges tracking rows past the retention period", async () => {
    const ctx = await setup();
    await saveAnalyticsSettings(ctx.owner.user, ctx.ws, { trackSiteVisits: true, trackEmailEngagement: true, retentionDays: 30 });
    const old = new Date(Date.now() - 40 * 86400000);
    await prisma.siteView.create({ data: { websiteId: ctx.site.id, workspaceId: ctx.ws, day: old, path: "home", visitorHash: "a".repeat(64), device: "desktop", createdAt: old } });
    await prisma.siteView.create({ data: { websiteId: ctx.site.id, workspaceId: ctx.ws, day: new Date(), path: "home", visitorHash: "b".repeat(64), device: "desktop" } });
    await purgeOldTracking();
    expect(await prisma.siteView.count({ where: { websiteId: ctx.site.id } })).toBe(1);
  });
});

describe("email engagement", () => {
  async function delivery(ctx, ctaUrl = "https://kirkgate.example.com/menu") {
    const campaign = await prisma.emailCampaign.create({ data: { workspaceId: ctx.ws, businessId: ctx.biz.id, name: "Rye launch", subject: "Rye", content: { heading: "Rye", paragraphs: ["Back"], ctaLabel: "Menu", ctaUrl }, status: "SENT", createdById: ctx.owner.user.id } });
    const contact = await prisma.emailContact.create({ data: { workspaceId: ctx.ws, businessId: ctx.biz.id, email: `c-${randomUUID().slice(0, 6)}@example.com`, consentSource: "Stall", consentAt: new Date(), unsubscribeToken: randomUUID().replace(/-/g, "").padEnd(43, "x") } });
    const d = await prisma.emailDelivery.create({ data: { campaignId: campaign.id, contactId: contact.id, status: "sent", provider: "resend", sentAt: new Date() } });
    return { campaign, d, token: signDeliveryToken(getEnv().NEXTAUTH_SECRET ?? "dev", d.id) };
  }

  it("counts the first open and click per email; clicks go only to the stored link", async () => {
    const ctx = await setup();
    const { d, token, campaign } = await delivery(ctx);
    expect(await recordEmailEvent(token, "open", { headers: hdrs() })).toEqual({ ctaUrl: "https://kirkgate.example.com/menu" });
    await recordEmailEvent(token, "open", { headers: hdrs() });
    expect((await recordEmailEvent(token, "click", { headers: hdrs() })).ctaUrl).toBe("https://kirkgate.example.com/menu");
    expect(await prisma.emailEvent.count({ where: { deliveryId: d.id } })).toBe(2);
    expect(await recordEmailEvent(`${d.id}.forged-signature-xxxxx`, "click", { headers: hdrs() })).toBeNull();

    const report = await getAnalytics(ctx.owner.user, ctx.ws, { days: 7 });
    expect(kpis(report)).toMatchObject({ "email.delivered": 1, "email.openRate": 1, "email.clickRate": 1 });
    expect(report.email.campaigns[0]).toMatchObject({ id: campaign.id, name: "Rye launch", delivered: 1, opened: 1, clicked: 1 });
  });

  it("a click on a link-less campaign or with tracking off records nothing unsafe", async () => {
    const ctx = await setup();
    const { d, token } = await delivery(ctx, "");
    expect((await recordEmailEvent(token, "click", { headers: hdrs() })).ctaUrl).toBeNull();
    await saveAnalyticsSettings(ctx.owner.user, ctx.ws, { trackSiteVisits: true, trackEmailEngagement: false, retentionDays: 395 });
    const second = await delivery(ctx);
    await recordEmailEvent(second.token, "open", { headers: hdrs() });
    expect(await prisma.emailEvent.count({ where: { deliveryId: second.d.id } })).toBe(0);
    expect(await prisma.emailEvent.count({ where: { deliveryId: d.id } })).toBe(2);
  });
});

describe("post results, sales and publishing", () => {
  it("editors record results of published posts; viewers can't; drafts are rejected", async () => {
    const ctx = await setup();
    const item = await publishedItem(ctx);
    const draft = await publishedItem(ctx, { status: "DRAFT", publishedAt: null });
    const editor = await createUser();
    const viewer = await createUser();
    await addMember(ctx.ws, editor.user.id, "EDITOR");
    await addMember(ctx.ws, viewer.user.id, "VIEWER");
    const m = postMetricsSchema.parse({ reach: 200, likes: 15, comments: 3, shares: 2 });
    await expect(savePostMetrics(viewer.user, ctx.ws, item.id, m)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(savePostMetrics(editor.user, ctx.ws, draft.id, m)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await savePostMetrics(editor.user, ctx.ws, item.id, m)).toMatchObject({ reach: 200, likes: 15 });
    expect((await savePostMetrics(editor.user, ctx.ws, item.id, postMetricsSchema.parse({ reach: 250 }))).likes).toBeNull();
    await savePostMetrics(editor.user, ctx.ws, item.id, m);

    const list = await listPostsForMetrics(viewer.user, ctx.ws, { days: 7 });
    expect(list.canEdit).toBe(false);
    expect(list.posts.map((p) => p.id)).toEqual([item.id]);
    const report = await getAnalytics(ctx.owner.user, ctx.ws, { days: 7 });
    expect(kpis(report)).toMatchObject({ "engagement.reach": 200, "engagement.interactions": 20, "engagement.rate": 0.1, "publishing.published": 1 });
  });

  it("sales come from paid invoices (BigInt) and quotes", async () => {
    const ctx = await setup();
    const doc = (over) => prisma.businessDocument.create({ data: { workspaceId: ctx.ws, businessId: ctx.biz.id, type: "INVOICE", number: `INV-${randomUUID().slice(0, 6)}`, status: "PAID", customer: { name: "C" }, issueDate: new Date(), currency: "GBP", lines: [], subtotalMinor: 0n, taxMinor: 0n, totalMinor: 12550n, paidAt: new Date(), createdById: ctx.owner.user.id, ...over } });
    await doc({});
    await doc({ totalMinor: 450n });
    await doc({ type: "QUOTE", status: "ACCEPTED", paidAt: null });
    const report = await getAnalytics(ctx.owner.user, ctx.ws, { days: 30 });
    expect(report.sales.paid).toEqual([{ currency: "GBP", totalMinor: "13000", previousMinor: "0" }]);
    expect(kpis(report)).toMatchObject({ "sales.invoicesPaid": 2, "sales.quoteAcceptance": 1 });
  });
});

describe("AI insights and reports", () => {
  it("generates checked insights from computed metrics and saves a report", async () => {
    const ctx = await setup();
    const r = await generateInsights(ctx.owner.user, ctx.ws, { days: 30 });
    expect(r.isMock).toBe(true);
    expect(r.insights.summary).toMatch(/^\[Mock\]/);
    // The fixture references "not.a.metric": it must be dropped.
    expect(r.insights.recommendations[1].metricKeys).toEqual(["engagement.posts"]);
    expect(r.metrics.period.days).toBe(30);
    expect((await listReports(ctx.owner.user, ctx.ws)).map((x) => x.id)).toEqual([r.id]);
    const gen = await prisma.aiGeneration.findFirst({ where: { workspaceId: ctx.ws, module: "analytics", task: "insights" }, orderBy: { createdAt: "desc" } });
    expect(gen.input.input).toContain("website.visitors");
    expect(gen.businessId).toBe(ctx.biz.id); // the only business → its approved context

    const viewer = await createUser();
    await addMember(ctx.ws, viewer.user.id, "VIEWER");
    await expect(generateInsights(viewer.user, ctx.ws, { days: 30 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(deleteReport(viewer.user, ctx.ws, r.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await deleteReport(ctx.owner.user, ctx.ws, r.id)).toEqual({ deleted: true });
    await expect(getReport(ctx.owner.user, ctx.ws, r.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("workspace isolation", () => {
  it("another workspace's data, businesses and reports are invisible", async () => {
    const a = await setup();
    const b = await setup();
    await recordSiteView(a.slug, { pageSlug: "home", ip: "203.0.113.9", headers: hdrs() });
    const item = await publishedItem(a);
    const report = await generateInsights(a.owner.user, a.ws, { days: 7 });

    expect(kpis(await getAnalytics(b.owner.user, b.ws, { days: 7 }))["website.pageviews"]).toBe(0);
    await expect(getAnalytics(b.owner.user, b.ws, { days: 7, businessId: a.biz.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getAnalyticsForExport(b.owner.user, b.ws, { days: 7, businessId: a.biz.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getAnalytics(b.owner.user, a.ws, { days: 7 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getReport(b.owner.user, b.ws, report.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteReport(b.owner.user, b.ws, report.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(savePostMetrics(b.owner.user, b.ws, item.id, postMetricsSchema.parse({ reach: 1 }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await listPostsForMetrics(b.owner.user, b.ws, { days: 7 })).posts).toEqual([]);
    expect(await listReports(b.owner.user, b.ws)).toEqual([]);
    // The business filter narrows to one business within a workspace.
    const other = await createBusiness(a.owner.user, a.ws, { name: "Second shop", stage: "STARTING" });
    expect(kpis(await getAnalytics(a.owner.user, a.ws, { days: 7, businessId: other.id }))["website.pageviews"]).toBe(0);
    expect(kpis(await getAnalytics(a.owner.user, a.ws, { days: 7, businessId: a.biz.id }))["website.pageviews"]).toBe(1);
  });
});
