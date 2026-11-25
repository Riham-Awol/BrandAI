import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma.js";
import { Errors } from "@/server/errors.js";
import { recordAudit } from "@/server/audit/service.js";
import { generateText } from "@/server/ai/orchestrator.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { findScopedBusiness } from "@/server/businesses/service.js";
import { uuidSchema } from "@/validation/common.js";
import { buildReport, dayKey, periodRange } from "./metrics.js";
import { INSIGHTS_INSTRUCTIONS, aiInsightsSchema, checkInsights, metricsForPrompt } from "./insights.js";
import { loadAnalyticsSettings } from "./tracking-service.js";
import "./mock-fixtures.js";

const DELIVERED = ["sent", "logged"];

async function resolveFilter(scope, businessId) {
  if (!businessId) return { businessId: null, business: null };
  const business = await findScopedBusiness(scope, businessId);
  return { businessId: business.id, business };
}

async function websiteData(workspaceId, businessId, range) {
  const sites = await prisma.website.findMany({ where: { workspaceId, deletedAt: null, ...(businessId ? { businessId } : {}) }, select: { id: true, status: true } });
  const ids = sites.map((s) => s.id);
  const empty = { visitors: 0, pageviews: 0, conversions: 0 };
  if (!ids.length) return { sites: 0, current: empty, previous: empty, daily: [], pages: [], sources: [], devices: [] };
  const viewsWhere = (from, to) => ({ workspaceId, websiteId: { in: ids }, day: { gte: from, lt: to } });
  const [dailyRows, pages, sources, devices, conv, prevConv] = await Promise.all([
    prisma.$queryRaw`SELECT day, COUNT(*) AS pageviews, COUNT(DISTINCT visitor_hash) AS visitors FROM site_views
      WHERE workspace_id = ${workspaceId} AND website_id IN (${Prisma.join(ids)}) AND day >= ${range.prevStart} AND day < ${range.end} GROUP BY day`,
    prisma.siteView.groupBy({ by: ["path"], where: viewsWhere(range.start, range.end), _count: { _all: true } }),
    prisma.siteView.groupBy({ by: ["referrerHost"], where: viewsWhere(range.start, range.end), _count: { _all: true } }),
    prisma.siteView.groupBy({ by: ["device"], where: viewsWhere(range.start, range.end), _count: { _all: true } }),
    prisma.websiteSubmission.count({ where: { workspaceId, websiteId: { in: ids }, createdAt: { gte: range.start, lt: range.end } } }),
    prisma.websiteSubmission.count({ where: { workspaceId, websiteId: { in: ids }, createdAt: { gte: range.prevStart, lt: range.prevEnd } } }),
  ]);
  const rows = dailyRows.map((r) => ({ day: dayKey(r.day), pageviews: Number(r.pageviews), visitors: Number(r.visitors) }));
  const startKey = dayKey(range.start);
  const cur = rows.filter((r) => r.day >= startKey);
  const prev = rows.filter((r) => r.day < startKey);
  const sum = (rs, k) => rs.reduce((s, r) => s + r[k], 0);
  return {
    sites: sites.filter((s) => s.status === "PUBLISHED").length,
    current: { visitors: sum(cur, "visitors"), pageviews: sum(cur, "pageviews"), conversions: conv },
    previous: { visitors: sum(prev, "visitors"), pageviews: sum(prev, "pageviews"), conversions: prevConv },
    daily: cur,
    pages: pages.map((p) => ({ path: p.path, views: p._count._all })),
    sources: sources.map((s) => ({ source: s.referrerHost, views: s._count._all })),
    devices: devices.map((d) => ({ device: d.device, views: d._count._all })),
  };
}

async function emailData(workspaceId, businessId, range) {
  const campaignWhere = { workspaceId, ...(businessId ? { businessId } : {}) };
  const summary = async (from, to) => {
    const deliveryWhere = { campaign: campaignWhere, createdAt: { gte: from, lt: to } };
    const [byStatus, opened, clicked, unsubscribed] = await Promise.all([
      prisma.emailDelivery.groupBy({ by: ["status"], where: deliveryWhere, _count: { _all: true } }),
      prisma.emailEvent.count({ where: { workspaceId, type: "open", delivery: deliveryWhere } }),
      prisma.emailEvent.count({ where: { workspaceId, type: "click", delivery: deliveryWhere } }),
      prisma.emailContact.count({ where: { workspaceId, ...(businessId ? { businessId } : {}), unsubscribedAt: { gte: from, lt: to } } }),
    ]);
    const n = (statuses) => byStatus.filter((s) => statuses.includes(s.status)).reduce((a, s) => a + s._count._all, 0);
    return { delivered: n(DELIVERED), failed: n(["failed"]), logged: n(["logged"]), opened, clicked, unsubscribed };
  };
  const [current, previous] = await Promise.all([summary(range.start, range.end), summary(range.prevStart, range.prevEnd)]);
  const deliveryWhere = { campaign: campaignWhere, createdAt: { gte: range.start, lt: range.end } };
  const [perCampaign, perEvent] = await Promise.all([
    prisma.emailDelivery.groupBy({ by: ["campaignId"], where: { ...deliveryWhere, status: { in: DELIVERED } }, _count: { _all: true } }),
    prisma.emailEvent.groupBy({ by: ["campaignId", "type"], where: { workspaceId, delivery: deliveryWhere }, _count: { _all: true } }),
  ]);
  const names = await prisma.emailCampaign.findMany({ where: { ...campaignWhere, id: { in: perCampaign.map((c) => c.campaignId) } }, select: { id: true, name: true, sentAt: true } });
  const ev = (id, type) => perEvent.find((e) => e.campaignId === id && e.type === type)?._count._all ?? 0;
  const campaigns = perCampaign
    .map((c) => {
      const meta = names.find((n) => n.id === c.campaignId);
      return { id: c.campaignId, name: meta?.name ?? "Campaign", sentAt: meta?.sentAt?.toISOString() ?? null, delivered: c._count._all, opened: ev(c.campaignId, "open"), clicked: ev(c.campaignId, "click") };
    })
    .sort((a, b) => b.delivered - a.delivered);
  return { current, previous, campaigns, campaignCount: campaigns.length, loggedOnly: current.delivered > 0 && current.logged === current.delivered };
}

async function publishingData(workspaceId, businessId, range) {
  const items = await prisma.scheduledItem.findMany({
    where: { workspaceId, deletedAt: null, ...(businessId ? { businessId } : {}), scheduledAt: { gte: range.prevStart, lt: range.end } },
    select: { status: true, scheduledAt: true, publishedAt: true, approvedAt: true, createdAt: true, sourceType: true, integration: { select: { name: true } } },
    take: 5000,
  });
  const shaped = items.map((i) => ({ ...i, channel: i.sourceType === "EMAIL_CAMPAIGN" ? "Email" : i.integration?.name ?? "Manual" }));
  return { items: shaped.filter((i) => i.scheduledAt >= range.start), previousItems: shaped.filter((i) => i.scheduledAt < range.start) };
}

const METRIC_FIELDS = ["reach", "impressions", "likes", "comments", "shares", "saves", "clicks"];

async function engagementData(workspaceId, businessId, range) {
  const rows = await prisma.postMetric.findMany({
    where: { workspaceId, ...(businessId ? { businessId } : {}), item: { deletedAt: null, publishedAt: { gte: range.prevStart, lt: range.end } } },
    select: { ...Object.fromEntries(METRIC_FIELDS.map((f) => [f, true])), item: { select: { id: true, title: true, publishedAt: true, externalUrl: true, integration: { select: { name: true } } } } },
    take: 2000,
  });
  const shaped = rows.map((r) => ({ itemId: r.item.id, title: r.item.title, channel: r.item.integration?.name ?? "Manual", publishedAt: r.item.publishedAt.toISOString(), externalUrl: r.item.externalUrl, ...Object.fromEntries(METRIC_FIELDS.map((f) => [f, r[f]])) }));
  return { posts: shaped.filter((p) => new Date(p.publishedAt) >= range.start), previousPosts: shaped.filter((p) => new Date(p.publishedAt) < range.start) };
}

async function salesData(workspaceId, businessId, range) {
  const docs = await prisma.businessDocument.findMany({
    where: {
      workspaceId, deletedAt: null, ...(businessId ? { businessId } : {}),
      OR: [{ type: "INVOICE", status: "SENT" }, { type: "INVOICE", paidAt: { gte: range.prevStart } }, { type: "QUOTE", issueDate: { gte: range.prevStart } }],
    },
    select: { type: true, status: true, currency: true, totalMinor: true, paidAt: true, issueDate: true, dueDate: true },
    take: 5000,
  });
  return { invoices: docs.filter((d) => d.type === "INVOICE"), quotes: docs.filter((d) => d.type === "QUOTE") };
}

/** Computes the report for a scope (no auth). */
async function computeReport(scope, { days, businessId }, now = new Date()) {
  const range = periodRange(days, now);
  const settings = await loadAnalyticsSettings(scope.workspaceId);
  const [website, email, publishing, engagement, sales] = await Promise.all([
    websiteData(scope.workspaceId, businessId, range),
    emailData(scope.workspaceId, businessId, range),
    publishingData(scope.workspaceId, businessId, range),
    engagementData(scope.workspaceId, businessId, range),
    salesData(scope.workspaceId, businessId, range),
  ]);
  return buildReport({ range, businessId, website, email, publishing, engagement, sales, trackSiteVisits: settings.trackSiteVisits, trackEmailEngagement: settings.trackEmailEngagement }, now);
}

export async function getAnalytics(user, workspaceId, { days, businessId }) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const filter = await resolveFilter(scope, businessId);
  return computeReport(scope, { days, businessId: filter.businessId });
}

/** Report plus the business name (for exports). */
export async function getAnalyticsForExport(user, workspaceId, { days, businessId }) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const filter = await resolveFilter(scope, businessId);
  const report = await computeReport(scope, { days, businessId: filter.businessId });
  return { report, businessName: filter.business?.name ?? "All businesses" };
}

/** Published posts of the period (not emails) with their entered results. */
export async function listPostsForMetrics(user, workspaceId, { days, businessId }) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const filter = await resolveFilter(scope, businessId);
  const range = periodRange(days);
  const items = await prisma.scheduledItem.findMany({
    where: { workspaceId: scope.workspaceId, deletedAt: null, status: "PUBLISHED", sourceType: { not: "EMAIL_CAMPAIGN" }, ...(filter.businessId ? { businessId: filter.businessId } : {}), publishedAt: { gte: range.start, lt: range.end } },
    orderBy: { publishedAt: "desc" },
    take: 100,
    select: { id: true, title: true, publishedAt: true, externalUrl: true, business: { select: { name: true } }, integration: { select: { name: true } }, metrics: { select: Object.fromEntries([...METRIC_FIELDS, "updatedAt"].map((f) => [f, true])) } },
  });
  return { canEdit: scope.can(PERMISSIONS.BUSINESS_UPDATE), posts: items.map((i) => ({ id: i.id, title: i.title, publishedAt: i.publishedAt, externalUrl: i.externalUrl, business: i.business.name, channel: i.integration?.name ?? "Manual", metrics: i.metrics })) };
}

/** Saves the results of one published post (numbers copied from the platform's insights). */
export async function savePostMetrics(user, workspaceId, itemId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  if (!uuidSchema.safeParse(itemId).success) throw Errors.notFound();
  const item = await prisma.scheduledItem.findFirst({ where: { id: itemId, workspaceId: scope.workspaceId, deletedAt: null }, select: { id: true, status: true, sourceType: true, businessId: true } });
  if (!item) throw Errors.notFound();
  if (item.status !== "PUBLISHED" || item.sourceType === "EMAIL_CAMPAIGN") throw Errors.validation({ reach: ["Results can only be added to published posts."] });
  const data = Object.fromEntries(METRIC_FIELDS.map((f) => [f, input[f] ?? null]));
  const saved = await prisma.postMetric.upsert({
    where: { scheduledItemId: item.id },
    create: { workspaceId: scope.workspaceId, businessId: item.businessId, scheduledItemId: item.id, recordedById: user.id, ...data },
    update: { ...data, recordedById: user.id },
    select: { ...Object.fromEntries(METRIC_FIELDS.map((f) => [f, true])), updatedAt: true },
  });
  await recordAudit({ action: "analytics.post_metrics_saved", actorId: user.id, workspaceId, entityType: "scheduled_item", entityId: item.id, request });
  return saved;
}

function presentReport(r) {
  return { id: r.id, businessId: r.businessId, business: r.business?.name ?? null, periodDays: r.periodDays, periodStart: r.periodStart, periodEnd: r.periodEnd, metrics: r.metrics, insights: r.insights, isMock: r.isMock, createdAt: r.createdAt };
}

/**
 * AI insights for the current numbers. The AI sees the computed metrics and
 * the approved business context; its output is checked and saved with the
 * metrics snapshot as a report.
 */
export async function generateInsights(user, workspaceId, { days, businessId }, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.AI_GENERATE);
  const filter = await resolveFilter(scope, businessId);
  const report = await computeReport(scope, { days, businessId: filter.businessId });
  // Approved context comes from the chosen business, or the only one when the workspace has one.
  let contextBusinessId = filter.businessId;
  if (!contextBusinessId) {
    const only = await prisma.business.findMany({ where: { workspaceId: scope.workspaceId, deletedAt: null }, select: { id: true }, take: 2 });
    if (only.length === 1) contextBusinessId = only[0].id;
  }
  const gaps = report.gaps.map((g) => `- ${g.message}`).join("\n") || "- None";
  const result = await generateText({
    user, workspaceId, businessId: contextBusinessId ?? undefined, module: "analytics", task: "insights",
    instructions: INSIGHTS_INSTRUCTIONS,
    input: `<scope>${filter.business ? `Business: ${filter.business.name}` : "All businesses in the workspace"}</scope>\n\n<metrics>\n${metricsForPrompt(report)}\n</metrics>\n\n<data_gaps>\n${gaps}\n</data_gaps>`,
    schema: aiInsightsSchema, effort: "medium", maxTokens: 3000, request,
  });
  const insights = { ...checkInsights(result.data, report), provider: result.provider ?? null };
  const saved = await prisma.analyticsReport.create({
    data: { workspaceId: scope.workspaceId, businessId: filter.businessId, periodDays: report.period.days, periodStart: new Date(report.period.start), periodEnd: new Date(report.period.end), metrics: report, insights, isMock: Boolean(result.isMock), createdById: user.id },
    include: { business: { select: { name: true } } },
  });
  await recordAudit({ action: "analytics.insights_generated", actorId: user.id, workspaceId, entityType: "analytics_report", entityId: saved.id, request });
  return presentReport(saved);
}

export async function listReports(user, workspaceId, { businessId } = {}) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const filter = await resolveFilter(scope, businessId);
  const rows = await prisma.analyticsReport.findMany({ where: { workspaceId: scope.workspaceId, ...(filter.businessId ? { businessId: filter.businessId } : {}) }, orderBy: { createdAt: "desc" }, take: 20, include: { business: { select: { name: true } } } });
  return rows.map(presentReport);
}

export async function getReport(user, workspaceId, reportId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  if (!uuidSchema.safeParse(reportId).success) throw Errors.notFound();
  const r = await prisma.analyticsReport.findFirst({ where: { id: reportId, workspaceId: scope.workspaceId }, include: { business: { select: { name: true } } } });
  if (!r) throw Errors.notFound();
  return presentReport(r);
}

export async function deleteReport(user, workspaceId, reportId, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  if (!uuidSchema.safeParse(reportId).success) throw Errors.notFound();
  const { count } = await prisma.analyticsReport.deleteMany({ where: { id: reportId, workspaceId: scope.workspaceId } });
  if (!count) throw Errors.notFound();
  await recordAudit({ action: "analytics.report_deleted", actorId: user.id, workspaceId, entityType: "analytics_report", entityId: reportId, request });
  return { deleted: true };
}

export async function getAnalyticsSettings(user, workspaceId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const s = await loadAnalyticsSettings(scope.workspaceId);
  return { trackSiteVisits: s.trackSiteVisits, trackEmailEngagement: s.trackEmailEngagement, retentionDays: s.retentionDays, canManage: scope.can(PERMISSIONS.ANALYTICS_MANAGE) };
}

export async function saveAnalyticsSettings(user, workspaceId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.ANALYTICS_MANAGE);
  await prisma.analyticsSettings.upsert({ where: { workspaceId: scope.workspaceId }, create: { workspaceId: scope.workspaceId, ...input, updatedById: user.id }, update: { ...input, updatedById: user.id } });
  await recordAudit({ action: "analytics.settings_updated", actorId: user.id, workspaceId, entityType: "workspace", entityId: scope.workspaceId, metadata: input, request });
  return getAnalyticsSettings(user, workspaceId);
}

/** What the current member may do on the analytics pages. */
export async function getAnalyticsPermissions(user, workspaceId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  return { canGenerate: scope.can(PERMISSIONS.AI_GENERATE), canEdit: scope.can(PERMISSIONS.BUSINESS_UPDATE), canManage: scope.can(PERMISSIONS.ANALYTICS_MANAGE) };
}
