import { describe, expect, it } from "vitest";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import "@/modules/analytics/mock-fixtures.js";
import { buildReport, change, fillDaily, formatChange, formatValue, periodRange, rate, salesMetrics, topWithOther, allKpis, publishingMetrics, engagementMetrics } from "@/modules/analytics/metrics.js";
import { aiInsightsSchema, allowedNumbers, checkInsights, metricsForPrompt, numbersIn } from "@/modules/analytics/insights.js";
import { deviceFrom, isBot, referrerSource, signDeliveryToken, utcDay, verifyDeliveryToken, visitorHash } from "@/modules/analytics/tracking.js";
import { csvCell, reportToCsv, reportToMarkdown } from "@/modules/analytics/export.js";
import { analyticsQuerySchema, analyticsSettingsSchema, postMetricsSchema } from "@/modules/analytics/schemas.js";
import { renderCampaignEmail } from "@/modules/automation/email-render.js";
import { PERMISSIONS, roleHasPermission } from "@/server/permissions/roles.js";

const NOW = new Date("2026-11-25T15:00:00Z");
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

function raw(overrides = {}) {
  const range = periodRange(7, NOW);
  return {
    range, businessId: null, trackSiteVisits: true, trackEmailEngagement: true,
    website: { sites: 1, current: { visitors: 40, pageviews: 100, conversions: 2 }, previous: { visitors: 20, pageviews: 50, conversions: 0 }, daily: [{ day: "2026-11-24", visitors: 10, pageviews: 30 }], pages: [{ path: "home", views: 80 }, { path: "menu", views: 20 }], sources: [{ source: null, views: 60 }, { source: "google.com", views: 40 }], devices: [{ device: "mobile", views: 70 }, { device: "desktop", views: 30 }] },
    email: { current: { delivered: 200, failed: 2, opened: 50, clicked: 10, unsubscribed: 1 }, previous: { delivered: 0, failed: 0, opened: 0, clicked: 0, unsubscribed: 0 }, campaigns: [{ id: "c", name: "Rye", delivered: 200, opened: 50, clicked: 10 }], campaignCount: 1, loggedOnly: false },
    publishing: { items: [], previousItems: [] },
    engagement: { posts: [], previousPosts: [] },
    sales: { invoices: [], quotes: [] },
    ...overrides,
  };
}

describe("metrics", () => {
  it("period ranges are whole UTC days and the previous period has the same length", () => {
    const r = periodRange(30, NOW);
    expect(r.end.toISOString()).toBe("2026-11-26T00:00:00.000Z");
    expect(r.start.toISOString()).toBe("2026-10-27T00:00:00.000Z");
    expect(r.prevEnd).toEqual(r.start);
    expect(r.start - r.prevStart).toBe(r.end - r.start);
    expect(periodRange(13, NOW).days).toBe(30); // unsupported → default
  });

  it("rates and changes never divide by zero", () => {
    expect(rate(1, 0)).toBeNull();
    expect(rate(1, 4)).toBe(0.25);
    expect(change(10, 0)).toBeNull();
    expect(change(15, 10)).toBeCloseTo(0.5);
    expect(formatChange(0.5)).toBe("+50%");
    expect(formatChange(-0.054)).toBe("−5%");
    expect(formatChange(null)).toBeNull();
    expect(formatValue(0.255, "percent")).toBe("26%");
    expect(formatValue(0.05, "percent")).toBe("5.0%");
    expect(formatValue(null, "number")).toBe("—");
    expect(formatValue(0.5, "hours")).toBe("30 min");
  });

  it("fills every day and folds long tails into Other", () => {
    const r = periodRange(7, NOW);
    const d = fillDaily(r, [{ day: "2026-11-24", visitors: 3, pageviews: 5 }], ["visitors", "pageviews"]);
    expect(d).toHaveLength(7);
    expect(d.at(-2)).toEqual({ day: "2026-11-24", visitors: 3, pageviews: 5 });
    expect(d[0].visitors).toBe(0);
    const t = topWithOther([1, 2, 3, 4].map((v) => ({ path: `p${v}`, views: v })), 2, "path");
    expect(t).toEqual([{ path: "p4", views: 4 }, { path: "p3", views: 3 }, { path: "Other", views: 3, other: true }]);
  });

  it("builds a report with website, email and gaps", () => {
    const rep = buildReport(raw(), NOW);
    const k = Object.fromEntries(allKpis(rep).map((x) => [x.key, x]));
    expect(k["website.visitors"]).toMatchObject({ value: 40, previous: 20, change: 1 });
    expect(k["website.conversionRate"].value).toBe(0.05);
    expect(k["website.conversionRate"].change).toBeNull(); // previous rate 0
    expect(k["email.openRate"].value).toBe(0.25);
    expect(rep.website.sources[0]).toEqual({ source: "Direct / unknown", views: 60 });
    expect(rep.website.devices.map((d) => d.device)).toEqual(["mobile", "desktop", "tablet"]);
    expect(rep.gaps.map((g) => g.area)).toEqual(["publishing", "engagement", "sales"]);
    const noSite = buildReport(raw({ website: { ...raw().website, sites: 0 }, email: { ...raw().email, loggedOnly: true } }), NOW);
    expect(noSite.gaps[0].message).toMatch(/No published website/);
    expect(noSite.gaps.some((g) => /development email provider/.test(g.message))).toBe(true);
  });

  it("publishing: on-time, missed, failures and per-channel counts", () => {
    const at = (h) => new Date(NOW.getTime() - h * 3600000);
    const items = [
      { status: "PUBLISHED", scheduledAt: at(10), publishedAt: at(9.5), createdAt: at(30), approvedAt: at(20), channel: "Telegram" },
      { status: "PUBLISHED", scheduledAt: at(10), publishedAt: at(5), createdAt: at(30), approvedAt: null, channel: "Telegram" },
      { status: "FAILED", scheduledAt: at(4), createdAt: at(30), channel: "Webhook" },
      { status: "MANUAL_DUE", scheduledAt: at(2), createdAt: at(30), channel: "Manual" },
      { status: "CANCELLED", scheduledAt: at(2), createdAt: at(30), channel: "Manual" },
    ];
    const p = publishingMetrics({ items, previousItems: [] }, NOW);
    const k = Object.fromEntries(p.kpis.map((x) => [x.key, x.value]));
    expect(k).toMatchObject({ "publishing.published": 2, "publishing.onTimeRate": 0.5, "publishing.failed": 1, "publishing.missed": 1, "publishing.approvalHours": 10 });
    expect(p.channels[0]).toEqual({ channel: "Telegram", scheduled: 2, published: 2, failed: 0 });
    expect(p.channels.find((c) => c.channel === "Manual").scheduled).toBe(1);
  });

  it("engagement rate uses only posts with reach", () => {
    const e = engagementMetrics({ posts: [{ title: "a", reach: 100, likes: 8, comments: 2 }, { title: "b", reach: null, likes: 50 }], previousPosts: [] });
    const k = Object.fromEntries(e.kpis.map((x) => [x.key, x.value]));
    expect(k["engagement.rate"]).toBe(0.1);
    expect(k["engagement.interactions"]).toBe(60);
    expect(e.posts[0].title).toBe("a");
  });

  it("sales totals are exact BigInt sums per currency", () => {
    const r = periodRange(30, NOW);
    const s = salesMetrics(r, {
      invoices: [
        { status: "PAID", currency: "GBP", totalMinor: 9007199254740993n, paidAt: new Date("2026-11-20") },
        { status: "PAID", currency: "GBP", totalMinor: 7n, paidAt: new Date("2026-11-21") },
        { status: "PAID", currency: "EUR", totalMinor: 100n, paidAt: new Date("2026-10-01") }, // previous period
        { status: "SENT", currency: "GBP", totalMinor: 500n, dueDate: new Date("2026-11-01") },
      ],
      quotes: [{ status: "ACCEPTED", issueDate: new Date("2026-11-10") }, { status: "DECLINED", issueDate: new Date("2026-11-11") }, { status: "SENT", issueDate: new Date("2026-11-12") }],
    }, NOW);
    expect(s.paid).toEqual([{ currency: "GBP", totalMinor: "9007199254741000", previousMinor: "0" }]);
    expect(s.outstanding).toEqual([{ currency: "GBP", totalMinor: "500" }]);
    const k = Object.fromEntries(s.kpis.map((x) => [x.key, x.value]));
    expect(k).toMatchObject({ "sales.invoicesPaid": 2, "sales.quotesSent": 3, "sales.quoteAcceptance": 0.5, "sales.overdue": 1 });
  });
});

describe("insights checks", () => {
  const report = buildReport(raw(), NOW);

  it("the mock fixture passes the AI schema", () => {
    expect(aiInsightsSchema.safeParse(mockFixtureResponder({ module: "analytics", task: "insights" }).data).success).toBe(true);
  });

  it("drops unknown metric keys and flags numbers not in the data", () => {
    const ai = aiInsightsSchema.parse({
      summary: "Visitors doubled to 40 and the open rate was 25%.",
      highlights: [{ title: "Traffic up", detail: "40 visitors, up 100% from 20.", sentiment: "positive", metricKeys: ["website.visitors", "made.up"] }],
      recommendations: [
        { title: "Post more", action: "Post 3 times a week.", why: "Visitors respond.", priority: "high", area: "social", metricKeys: [] },
        { title: "Fix email", action: "Your open rate is 61%.", why: "Industry average is 2,500.", priority: "low", area: "email", metricKeys: ["email.openRate"] },
      ],
      dataGaps: [],
    });
    const out = checkInsights(ai, report);
    expect(out.summaryVerified).toBe(true);
    expect(out.highlights[0]).toMatchObject({ verified: true, metricKeys: ["website.visitors"] });
    expect(out.recommendations[0].verified).toBe(true);
    expect(out.recommendations[1].verified).toBe(false);
  });

  it("rewrites metric keys in prose as plain names", () => {
    const ai = aiInsightsSchema.parse({ summary: "website.visitors reached 40; website.conversionRate is 5%.", highlights: [], recommendations: [{ title: "T", action: "Lift email.openRate.", why: "W", metricKeys: [] }], dataGaps: [] });
    const out = checkInsights(ai, report);
    expect(out.summary).toBe("visitors reached 40; conversion rate is 5%.");
    expect(out.recommendations[0].action).toBe("Lift open rate.");
    expect(out.summaryVerified).toBe(true);
  });

  it("extracts numbers and builds the allowed set", () => {
    expect(numbersIn("1,250 visits, 12.0% and 3.5 h")).toEqual(["1250", "12", "3.5"]);
    const allowed = allowedNumbers(report);
    expect(allowed.has("25")).toBe(true); // open rate %
    expect(allowed.has("100")).toBe(true); // +100% change
    expect(metricsForPrompt(report)).toContain("website.visitors (Visitors): 40; previous 20; change +100%");
  });
});

describe("tracking", () => {
  it("filters bots and classifies devices", () => {
    expect(isBot("")).toBe(true);
    expect(isBot("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe(true);
    expect(isBot("Mozilla/5.0 HeadlessChrome/140")).toBe(true);
    expect(isBot(CHROME)).toBe(false);
    expect(deviceFrom(IPHONE)).toBe("mobile");
    expect(deviceFrom("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)")).toBe("tablet");
    expect(deviceFrom(CHROME)).toBe("desktop");
  });

  it("works out the source without self-referrals or junk", () => {
    expect(referrerSource({ referer: "https://www.google.com/search?q=x", ownHost: "app.example.com" })).toBe("google.com");
    expect(referrerSource({ referer: "https://app.example.com/sites/a", ownHost: "app.example.com:443" })).toBeNull();
    expect(referrerSource({ referer: "javascript:alert(1)" })).toBeNull();
    expect(referrerSource({ referer: "http://localhost:3000/" })).toBeNull();
    expect(referrerSource({ utmSource: "Newsletter", referer: "https://google.com" })).toBe("utm:newsletter");
    expect(referrerSource({ utmSource: "<script>" })).toBeNull();
  });

  it("visitor hashes rotate daily and never contain the IP", () => {
    const a = visitorHash({ secret: "s", day: utcDay(NOW), siteId: "x", ip: "203.0.113.5", userAgent: CHROME });
    const b = visitorHash({ secret: "s", day: utcDay(new Date(NOW.getTime() + 86400000)), siteId: "x", ip: "203.0.113.5", userAgent: CHROME });
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain("203");
  });

  it("delivery tokens are signed", () => {
    const id = "8d3b8f0e-7a52-4c1b-9d2e-3f4a5b6c7d8e";
    const t = signDeliveryToken("secret", id);
    expect(verifyDeliveryToken("secret", t)).toBe(id);
    expect(verifyDeliveryToken("other", t)).toBeNull();
    expect(verifyDeliveryToken("secret", `${id}.forged`)).toBeNull();
    expect(verifyDeliveryToken("secret", "not-a-token")).toBeNull();
  });

  it("campaign emails use the click redirect and open pixel only when given", () => {
    const content = { heading: "Hi", paragraphs: ["P"], ctaLabel: "Go", ctaUrl: "https://shop.example.com" };
    const plain = renderCampaignEmail({ subject: "S", preheader: "", content, brandName: "B", unsubscribeUrl: "https://app/u/x" });
    expect(plain.html).toContain('href="https://shop.example.com"');
    expect(plain.html).not.toContain("/open");
    const tracked = renderCampaignEmail({ subject: "S", preheader: "", content, brandName: "B", unsubscribeUrl: "https://app/u/x", ctaHref: "https://app/api/v1/email/t/click", openPixelUrl: "https://app/api/v1/email/t/open" });
    expect(tracked.html).toContain('href="https://app/api/v1/email/t/click"');
    expect(tracked.html).toContain('<img src="https://app/api/v1/email/t/open"');
    expect(tracked.text).toContain("Go: https://app/api/v1/email/t/click");
  });
});

describe("exports, schemas and permissions", () => {
  const report = buildReport(raw(), NOW);

  it("CSV neutralises formulas and Markdown escapes text", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell("-12%")).toBe('"-12%"');
    expect(csvCell("-1+1")).toBe(`"'-1+1"`);
    const csv = reportToCsv(report, { businessName: "Rye & Co" });
    expect(csv).toContain('"Website","Visitors","website.visitors","40","20","+100%"');
    expect(csv).toContain('"Email","Open rate","email.openRate","25.0%"');
    const md = reportToMarkdown(report, { businessName: "Rye_Co", insights: { summary: "S", highlights: [], recommendations: [{ title: "T", action: "A", why: "W", priority: "high", verified: false }] } });
    expect(md).toContain("# Performance report — Rye\\_Co");
    expect(md).toContain("| Visitors | 40 | 20 | +100% |");
    expect(md).toContain("_(check the numbers)_");
  });

  it("validates inputs", () => {
    expect(analyticsQuerySchema.parse({})).toEqual({ days: 30 });
    expect(analyticsQuerySchema.safeParse({ days: "14" }).success).toBe(false);
    expect(analyticsQuerySchema.parse({ days: "7", businessId: "all" })).toEqual({ days: 7 });
    expect(postMetricsSchema.safeParse({ reach: "" }).success).toBe(false);
    expect(postMetricsSchema.parse({ reach: "120", likes: 4 })).toMatchObject({ reach: 120, likes: 4 });
    expect(postMetricsSchema.safeParse({ reach: -1 }).success).toBe(false);
    expect(analyticsSettingsSchema.safeParse({ trackSiteVisits: true, trackEmailEngagement: false, retentionDays: 10 }).success).toBe(false);
  });

  it("only admins and the owner manage tracking", () => {
    expect(roleHasPermission("OWNER", PERMISSIONS.ANALYTICS_MANAGE)).toBe(true);
    expect(roleHasPermission("ADMIN", PERMISSIONS.ANALYTICS_MANAGE)).toBe(true);
    expect(roleHasPermission("EDITOR", PERMISSIONS.ANALYTICS_MANAGE)).toBe(false);
    expect(roleHasPermission("VIEWER", PERMISSIONS.ANALYTICS_MANAGE)).toBe(false);
  });
});
