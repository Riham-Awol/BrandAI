import { z } from "zod";
import { allKpis, formatChange, formatValue } from "./metrics.js";

/**
 * AI insights: the model reads the computed metrics (never raw rows) and
 * returns explanations and recommendations that point at metric keys. Its
 * output is checked: unknown keys are dropped, and any number in the text
 * that can't be matched to the data marks that item as "unverified".
 */

export const AREAS = ["website", "email", "social", "sales", "publishing", "general"];

const text = (max) => z.string().trim().min(1).max(max);

export const aiInsightsSchema = z.object({
  summary: text(700),
  highlights: z.array(z.object({ title: text(120), detail: text(400), sentiment: z.enum(["positive", "negative", "neutral"]).catch("neutral"), metricKeys: z.array(z.string().max(60)).max(6).catch([]) })).max(6),
  recommendations: z.array(z.object({
    title: text(120), action: text(500), why: text(400),
    priority: z.enum(["high", "medium", "low"]).catch("medium"),
    area: z.enum(AREAS).catch("general"),
    metricKeys: z.array(z.string().max(60)).max(6).catch([]),
  })).min(1).max(6),
  dataGaps: z.array(text(300)).max(6).catch([]),
});

export const INSIGHTS_INSTRUCTIONS = [
  "You are a calm, practical marketing analyst for a small business. You explain what the numbers mean and what to do next.",
  "Use ONLY the metrics given in <metrics>. Never invent figures, causes you can't see, benchmarks, or industry averages.",
  "When you mention a number, copy it exactly as written in <metrics>. Prefer words (\"about a third\") over new calculations.",
  "Each highlight and recommendation lists the metric keys (e.g. website.visitors) it is based on in metricKeys, from <metrics> only. In the text itself, use the plain-language name in brackets (\"visitors\"), never the key.",
  "Recommendations are concrete actions the owner can take this week inside their tools (website, social posts, email, invoices), ordered by impact.",
  "Where data is missing (see <data_gaps>), say what to set up instead of drawing conclusions from zeros.",
  "Use the business's approved context for tone and relevance; don't repeat it back.",
].join("\n");

/** Compact, human-readable metrics block for the prompt (same formatting the UI shows). */
export function metricsForPrompt(report) {
  const lines = [`Period: last ${report.period.days} days, compared with the ${report.period.days} days before.`];
  for (const k of allKpis(report)) {
    const ch = formatChange(k.change);
    lines.push(`${k.key} (${k.label}): ${formatValue(k.value, k.format)}${k.previous != null ? `; previous ${formatValue(k.previous, k.format)}` : ""}${ch ? `; change ${ch}` : ""}`);
  }
  const top = (rows, label) => rows.slice(0, 5).map((r) => `${r[label]} ${r.views}`).join(", ");
  if (report.website.pages.length) lines.push(`Top pages (views): ${top(report.website.pages, "path")}`);
  if (report.website.sources.length) lines.push(`Top sources (views): ${top(report.website.sources, "source")}`);
  lines.push(`Devices (views): ${report.website.devices.map((d) => `${d.device} ${d.views}`).join(", ")}`);
  for (const c of report.email.campaigns.slice(0, 5)) lines.push(`Campaign "${c.name}": sent ${c.delivered}, open rate ${formatValue(c.openRate, "percent")}, click rate ${formatValue(c.clickRate, "percent")}`);
  for (const c of report.publishing.channels.slice(0, 5)) lines.push(`Channel ${c.channel}: scheduled ${c.scheduled}, published ${c.published}, failed ${c.failed}`);
  for (const p of report.engagement.posts.slice(0, 5)) lines.push(`Post "${p.title}" (${p.channel}): reach ${p.reach ?? "—"}, interactions ${p.interactions}, engagement rate ${formatValue(p.rate, "percent")}`);
  for (const x of report.sales.paid) lines.push(`Paid in ${x.currency} (minor units): ${x.totalMinor}; previous ${x.previousMinor}`);
  return lines.join("\n");
}

/** Numbers the data can justify: values as shown, raw counts, percentages and the period lengths. */
export function allowedNumbers(report) {
  const out = new Set([String(report.period.days), String(report.period.days * 2), "1", "2", "3"]);
  const add = (v) => {
    if (v == null || !Number.isFinite(Number(v))) return;
    const n = Number(v);
    out.add(String(Math.round(n)));
    out.add(n.toFixed(1).replace(/\.0$/, ""));
  };
  const addPct = (v) => {
    if (v == null) return;
    add(v * 100);
  };
  for (const k of allKpis(report)) {
    if (k.format === "percent") {
      addPct(k.value);
      addPct(k.previous);
    } else {
      add(k.value);
      add(k.previous);
    }
    if (k.change != null) {
      addPct(Math.abs(k.change));
      if (k.value != null && k.previous != null) add(Math.abs(k.value - k.previous) * (k.format === "percent" ? 100 : 1));
    }
  }
  for (const r of [...report.website.pages, ...report.website.sources, ...report.website.devices]) add(r.views);
  for (const c of report.email.campaigns) {
    [c.delivered, c.opened, c.clicked].forEach(add);
    addPct(c.openRate);
    addPct(c.clickRate);
  }
  for (const c of report.publishing.channels) [c.scheduled, c.published, c.failed].forEach(add);
  for (const p of report.engagement.posts) {
    [p.reach, p.impressions, p.likes, p.comments, p.shares, p.saves, p.clicks, p.interactions].forEach(add);
    addPct(p.rate);
  }
  for (const x of [...report.sales.paid, ...report.sales.outstanding]) {
    out.add(String(x.totalMinor));
    // Money mentioned in major units (e.g. "£1,250" or "1250.50").
    const major = Number(x.totalMinor) / 100;
    add(major);
    out.add(major.toFixed(2));
  }
  return out;
}

/** Numbers written in a piece of text, normalised ("1,250" → "1250", "12.0%" → "12"). */
export function numbersIn(textValue) {
  return [...String(textValue).matchAll(/(?<![\w.])\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replace(/,/g, "").replace(/\.0+$/, ""));
}

/** Replaces metric keys written in prose ("website.visitors") with their plain names ("visitors"). */
export function humanizeKeys(textValue, labels) {
  return String(textValue).replace(/\b(website|email|publishing|engagement|sales)\.([a-zA-Z]+)\b/g, (m) => (labels[m] ? labels[m].toLowerCase() : m));
}

/** Validates AI insights against the report. Pure. */
export function checkInsights(ai, report) {
  const kpis = allKpis(report);
  const keys = new Set(kpis.map((k) => k.key));
  const labels = Object.fromEntries(kpis.map((k) => [k.key, k.label]));
  const h = (t) => humanizeKeys(t, labels);
  const allowed = allowedNumbers(report);
  const verify = (...parts) => numbersIn(parts.join(" ")).every((n) => allowed.has(n) || allowed.has(String(Math.round(Number(n)))));
  const highlights = ai.highlights.map((x) => ({ ...x, title: h(x.title), detail: h(x.detail), metricKeys: x.metricKeys.filter((k) => keys.has(k)), verified: verify(x.title, x.detail) }));
  const recommendations = ai.recommendations.map((r) => ({ ...r, title: h(r.title), action: h(r.action), why: h(r.why), metricKeys: r.metricKeys.filter((k) => keys.has(k)), verified: verify(r.title, r.action, r.why) }));
  return { summary: h(ai.summary), summaryVerified: verify(ai.summary), highlights, recommendations, dataGaps: ai.dataGaps.map(h) };
}
