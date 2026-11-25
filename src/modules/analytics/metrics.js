/**
 * Pure analytics calculations. Every number the business sees is computed
 * here from stored rows: AI never produces or alters figures. Money stays in
 * BigInt minor units and is returned as strings.
 */

export const PERIODS = [7, 30, 90];
const DAY = 86400000;

/** The current period (ending now, whole UTC days) and the same-length period before it. */
export function periodRange(days, now = new Date()) {
  const n = PERIODS.includes(Number(days)) ? Number(days) : 30;
  const endDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + DAY; // exclusive: tomorrow 00:00
  const start = new Date(endDay - n * DAY);
  return { days: n, start, end: new Date(endDay), prevStart: new Date(endDay - 2 * n * DAY), prevEnd: start };
}

export const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

/** Every day of the range as "YYYY-MM-DD", oldest first. */
export function rangeDays(range) {
  const out = [];
  for (let t = range.start.getTime(); t < range.end.getTime(); t += DAY) out.push(dayKey(t));
  return out;
}

/** n / d, or null when there's nothing to divide by. */
export function rate(n, d) {
  return d > 0 ? n / d : null;
}

/** Relative change vs the previous period; null when the previous value is 0 or unknown. */
export function change(current, previous) {
  if (current == null || previous == null || previous === 0) return null;
  return (current - previous) / previous;
}

function kpi(key, label, current, previous, format, extra = {}) {
  return { key, label, value: current, previous, change: change(current, previous), format, ...extra };
}

const median = (values) => {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

const inRange = (date, from, to) => date && new Date(date) >= from && new Date(date) < to;

/** Fills a per-day series so every day of the period has a value (0 when no rows). */
export function fillDaily(range, rows, fields) {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return rangeDays(range).map((day) => {
    const r = byDay.get(day) ?? {};
    return Object.fromEntries([["day", day], ...fields.map((f) => [f, Number(r[f] ?? 0)])]);
  });
}

/** Keeps the top n rows by `views`, folding the rest into "Other". */
export function topWithOther(rows, n, labelKey, otherLabel = "Other") {
  const sorted = [...rows].sort((a, b) => b.views - a.views || String(a[labelKey]).localeCompare(String(b[labelKey])));
  if (sorted.length <= n) return sorted;
  const rest = sorted.slice(n).reduce((s, r) => s + r.views, 0);
  return [...sorted.slice(0, n), { [labelKey]: otherLabel, views: rest, other: true }];
}

export function websiteMetrics(range, w) {
  const cur = w.current;
  const prev = w.previous;
  return {
    sites: w.sites,
    kpis: [
      kpi("website.visitors", "Visitors", cur.visitors, prev.visitors, "number", { hint: "Unique visitors per day, added up" }),
      kpi("website.pageviews", "Page views", cur.pageviews, prev.pageviews, "number"),
      kpi("website.conversions", "Enquiries & orders", cur.conversions, prev.conversions, "number", { hint: "Form messages from your sites" }),
      kpi("website.conversionRate", "Conversion rate", rate(cur.conversions, cur.visitors), rate(prev.conversions, prev.visitors), "percent", { hint: "Enquiries ÷ visitors" }),
    ],
    daily: fillDaily(range, w.daily, ["visitors", "pageviews"]),
    pages: topWithOther(w.pages, 6, "path"),
    sources: topWithOther(w.sources.map((r) => ({ source: r.source ?? "Direct / unknown", views: r.views })), 6, "source"),
    devices: ["mobile", "desktop", "tablet"].map((d) => ({ device: d, views: w.devices.find((x) => x.device === d)?.views ?? 0 })),
  };
}

export function emailMetrics(e) {
  const c = e.current;
  const p = e.previous;
  return {
    loggedOnly: e.loggedOnly,
    kpis: [
      kpi("email.delivered", "Emails sent", c.delivered, p.delivered, "number"),
      kpi("email.openRate", "Open rate", rate(c.opened, c.delivered), rate(p.opened, p.delivered), "percent", { hint: "Approximate: some apps block or pre-load images" }),
      kpi("email.clickRate", "Click rate", rate(c.clicked, c.delivered), rate(p.clicked, p.delivered), "percent"),
      kpi("email.unsubscribes", "Unsubscribes", c.unsubscribed, p.unsubscribed, "number", { goodWhen: "down" }),
      kpi("email.failed", "Failed sends", c.failed, p.failed, "number", { goodWhen: "down" }),
    ],
    campaigns: e.campaigns.map((x) => ({ ...x, openRate: rate(x.opened, x.delivered), clickRate: rate(x.clicked, x.delivered) })),
  };
}

const ON_TIME_MS = 60 * 60 * 1000;

function publishingSummary(items, now) {
  const published = items.filter((i) => i.status === "PUBLISHED");
  const onTime = published.filter((i) => i.publishedAt && new Date(i.publishedAt) - new Date(i.scheduledAt) <= ON_TIME_MS);
  const missed = items.filter((i) => i.status === "MANUAL_DUE" && new Date(i.scheduledAt) < now);
  const turnaround = items.filter((i) => i.approvedAt).map((i) => (new Date(i.approvedAt) - new Date(i.createdAt)) / 3600000);
  return { scheduled: items.filter((i) => !["CANCELLED", "REJECTED", "DRAFT"].includes(i.status)).length, published: published.length, onTime: onTime.length, failed: items.filter((i) => i.status === "FAILED").length, missed: missed.length, turnaroundHours: median(turnaround) };
}

export function publishingMetrics(pub, now = new Date()) {
  const c = publishingSummary(pub.items, now);
  const p = publishingSummary(pub.previousItems, now);
  const channels = new Map();
  for (const i of pub.items.filter((x) => !["CANCELLED", "REJECTED", "DRAFT"].includes(x.status))) {
    const k = i.channel ?? "Manual";
    const row = channels.get(k) ?? { channel: k, scheduled: 0, published: 0, failed: 0 };
    row.scheduled++;
    if (i.status === "PUBLISHED") row.published++;
    if (i.status === "FAILED") row.failed++;
    channels.set(k, row);
  }
  return {
    kpis: [
      kpi("publishing.published", "Posts & emails published", c.published, p.published, "number"),
      kpi("publishing.onTimeRate", "On time", rate(c.onTime, c.published), rate(p.onTime, p.published), "percent", { hint: "Published within an hour of the planned time" }),
      kpi("publishing.missed", "Missed manual posts", c.missed, p.missed, "number", { goodWhen: "down" }),
      kpi("publishing.failed", "Failed", c.failed, p.failed, "number", { goodWhen: "down" }),
      kpi("publishing.approvalHours", "Median time to approval", c.turnaroundHours, p.turnaroundHours, "hours", { goodWhen: "down" }),
    ],
    channels: [...channels.values()].sort((a, b) => b.scheduled - a.scheduled || a.channel.localeCompare(b.channel)),
  };
}

const interactions = (m) => ["likes", "comments", "shares", "saves"].reduce((s, k) => s + (m[k] ?? 0), 0);

function engagementSummary(posts) {
  const withReach = posts.filter((p) => p.reach > 0);
  const sum = (k) => posts.reduce((s, p) => s + (p[k] ?? 0), 0);
  return {
    posts: posts.length, reach: sum("reach"), interactions: posts.reduce((s, p) => s + interactions(p), 0), clicks: sum("clicks"),
    rate: rate(withReach.reduce((s, p) => s + interactions(p), 0), withReach.reduce((s, p) => s + p.reach, 0)),
  };
}

export function engagementMetrics(eng) {
  const c = engagementSummary(eng.posts);
  const p = engagementSummary(eng.previousPosts);
  return {
    kpis: [
      kpi("engagement.posts", "Posts with results", c.posts, p.posts, "number"),
      kpi("engagement.reach", "Reach", c.reach, p.reach, "number"),
      kpi("engagement.interactions", "Interactions", c.interactions, p.interactions, "number", { hint: "Likes, comments, shares and saves" }),
      kpi("engagement.rate", "Engagement rate", c.rate, p.rate, "percent", { hint: "Interactions ÷ reach" }),
      kpi("engagement.clicks", "Link clicks", c.clicks, p.clicks, "number"),
    ],
    posts: eng.posts
      .map((x) => ({ ...x, interactions: interactions(x), rate: rate(interactions(x), x.reach ?? 0) }))
      .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.interactions - a.interactions),
  };
}

function sumByCurrency(docs) {
  const out = new Map();
  for (const d of docs) out.set(d.currency, (out.get(d.currency) ?? 0n) + BigInt(d.totalMinor));
  return [...out.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, minor]) => ({ currency, totalMinor: minor.toString() }));
}

export function salesMetrics(range, s, now = new Date()) {
  const paid = (from, to) => s.invoices.filter((i) => i.status === "PAID" && inRange(i.paidAt, from, to));
  const quotes = (from, to) => s.quotes.filter((q) => q.status !== "VOID" && q.status !== "DRAFT" && inRange(q.issueDate, from, to));
  const accept = (qs) => rate(qs.filter((q) => q.status === "ACCEPTED").length, qs.filter((q) => ["ACCEPTED", "DECLINED"].includes(q.status)).length);
  const curPaid = paid(range.start, range.end);
  const prevPaid = paid(range.prevStart, range.prevEnd);
  const curQ = quotes(range.start, range.end);
  const prevQ = quotes(range.prevStart, range.prevEnd);
  const outstanding = s.invoices.filter((i) => i.status === "SENT");
  const prevTotals = new Map(sumByCurrency(prevPaid).map((x) => [x.currency, x.totalMinor]));
  return {
    kpis: [
      kpi("sales.invoicesPaid", "Invoices paid", curPaid.length, prevPaid.length, "number"),
      kpi("sales.quotesSent", "Quotes sent", curQ.length, prevQ.length, "number"),
      kpi("sales.quoteAcceptance", "Quote acceptance", accept(curQ), accept(prevQ), "percent", { hint: "Accepted ÷ (accepted + declined)" }),
      kpi("sales.overdue", "Overdue invoices", outstanding.filter((i) => i.dueDate && new Date(i.dueDate) < now).length, null, "number", { goodWhen: "down" }),
    ],
    paid: sumByCurrency(curPaid).map((x) => ({ ...x, previousMinor: prevTotals.get(x.currency) ?? "0" })),
    outstanding: sumByCurrency(outstanding),
  };
}

/** Explains what's missing, so neither people nor the AI read "no data" as "bad results". */
export function dataGaps(raw, sections) {
  const gaps = [];
  if (!raw.website.sites) gaps.push({ area: "website", message: "No published website yet, so there's no traffic to report." });
  else if (!raw.trackSiteVisits) gaps.push({ area: "website", message: "Website visit tracking is switched off in analytics settings." });
  else if (!sections.website.kpis[1].value) gaps.push({ area: "website", message: "Your published sites had no recorded visits in this period." });
  if (!raw.email.campaignCount) gaps.push({ area: "email", message: "No email campaigns were sent in this period." });
  else if (!raw.trackEmailEngagement) gaps.push({ area: "email", message: "Email open and click tracking is switched off." });
  if (raw.email.loggedOnly) gaps.push({ area: "email", message: "Emails were only logged by the development email provider, not delivered, so opens and clicks can't happen." });
  if (!raw.publishing.items.length) gaps.push({ area: "publishing", message: "Nothing was scheduled in this period." });
  if (!raw.engagement.posts.length) gaps.push({ area: "engagement", message: "No post results entered yet. Add reach and likes from each platform's insights to see engagement." });
  if (!raw.sales.invoices.length && !raw.sales.quotes.length) gaps.push({ area: "sales", message: "No invoices or quotes yet." });
  return gaps;
}

/** Builds the full report from aggregated rows. Pure and deterministic. */
export function buildReport(raw, now = new Date()) {
  const sections = {
    website: websiteMetrics(raw.range, raw.website),
    email: emailMetrics(raw.email),
    publishing: publishingMetrics(raw.publishing, now),
    engagement: engagementMetrics(raw.engagement),
    sales: salesMetrics(raw.range, raw.sales, now),
  };
  return {
    period: { days: raw.range.days, start: raw.range.start.toISOString(), end: raw.range.end.toISOString(), previousStart: raw.range.prevStart.toISOString() },
    businessId: raw.businessId ?? null,
    ...sections,
    gaps: dataGaps(raw, sections),
    generatedAt: now.toISOString(),
  };
}

/** Every KPI of a report, flattened. */
export function allKpis(report) {
  return ["website", "email", "publishing", "engagement", "sales"].flatMap((s) => report[s].kpis.map((k) => ({ ...k, section: s })));
}

/** Formats a KPI value for people (and for the AI prompt). */
export function formatValue(value, format) {
  if (value == null) return "—";
  if (format === "percent") return `${(value * 100).toFixed(value * 100 >= 10 || value === 0 ? 0 : 1)}%`;
  if (format === "hours") return value < 1 ? `${Math.round(value * 60)} min` : `${value.toFixed(value < 10 ? 1 : 0)} h`;
  return Math.round(value).toLocaleString("en-GB");
}

/** "+12%" / "−5%" / null. */
export function formatChange(c) {
  if (c == null || !Number.isFinite(c)) return null;
  const pct = Math.round(c * 100);
  return pct === 0 ? "0%" : `${pct > 0 ? "+" : "−"}${Math.abs(pct)}%`;
}
