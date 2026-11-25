import { formatMoney } from "@/modules/stationery/money.js";
import { allKpis, formatChange, formatValue } from "./metrics.js";

/** Exports of a report. Pure. */

/** CSV cell: quoted, and formula-like values neutralised (CSV injection). */
export function csvCell(value) {
  let s = value == null ? "" : String(value);
  // Plain signed numbers ("+12%", "-3") are data, not formulas.
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?\d[\d.,]*%?$/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const row = (cells) => cells.map(csvCell).join(",");
const SECTION_LABELS = { website: "Website", email: "Email", publishing: "Publishing", engagement: "Social engagement", sales: "Sales" };

export function reportToCsv(report, { businessName = "" } = {}) {
  const lines = [row(["Brand AI performance report", businessName, `${report.period.start.slice(0, 10)} to ${new Date(new Date(report.period.end).getTime() - 1).toISOString().slice(0, 10)}`]), ""];
  lines.push(row(["Section", "Metric", "Key", "Value", "Previous period", "Change"]));
  for (const k of allKpis(report)) {
    const raw = (v) => (v == null ? "" : k.format === "percent" ? (v * 100).toFixed(1) + "%" : k.format === "hours" ? v.toFixed(1) : String(Math.round(v)));
    lines.push(row([SECTION_LABELS[k.section], k.label, k.key, raw(k.value), raw(k.previous), formatChange(k.change) ?? ""]));
  }
  lines.push("", row(["Day", "Visitors", "Page views"]));
  for (const d of report.website.daily) lines.push(row([d.day, d.visitors, d.pageviews]));
  lines.push("", row(["Top pages", "Views"]), ...report.website.pages.map((p) => row([p.path, p.views])));
  lines.push("", row(["Sources", "Views"]), ...report.website.sources.map((p) => row([p.source, p.views])));
  lines.push("", row(["Campaign", "Sent", "Opened", "Clicked"]), ...report.email.campaigns.map((c) => row([c.name, c.delivered, c.opened, c.clicked])));
  lines.push("", row(["Post", "Channel", "Reach", "Interactions", "Clicks"]), ...report.engagement.posts.map((p) => row([p.title, p.channel, p.reach ?? "", p.interactions, p.clicks ?? ""])));
  lines.push("", row(["Paid invoices", "Currency", "Amount"]), ...report.sales.paid.map((x) => row(["Paid", x.currency, formatMoney(x.totalMinor, x.currency)])));
  return lines.join("\r\n") + "\r\n";
}

const md = (s) => String(s ?? "").replace(/([\\`*_[\]|<>#])/g, "\\$1");

export function reportToMarkdown(report, { businessName = "All businesses", insights = null, createdAt = null } = {}) {
  const end = new Date(new Date(report.period.end).getTime() - 1).toISOString().slice(0, 10);
  const out = [`# Performance report — ${md(businessName)}`, "", `Last ${report.period.days} days (${report.period.start.slice(0, 10)} to ${end}), compared with the ${report.period.days} days before.${createdAt ? ` Generated ${new Date(createdAt).toISOString().slice(0, 10)}.` : ""}`, ""];
  if (insights) {
    out.push("## Summary", "", md(insights.summary), "");
    if (insights.highlights?.length) {
      out.push("## What happened", "");
      for (const h of insights.highlights) out.push(`- **${md(h.title)}** — ${md(h.detail)}${h.verified === false ? " _(contains a number we couldn't match to your data — check it)_" : ""}`);
      out.push("");
    }
    out.push("## Recommendations", "");
    insights.recommendations.forEach((r, i) => out.push(`${i + 1}. **${md(r.title)}** (${r.priority} priority) — ${md(r.action)} _Why:_ ${md(r.why)}${r.verified === false ? " _(check the numbers)_" : ""}`));
    out.push("", "_Insights are written by AI from the numbers below; the numbers themselves are calculated by Brand AI._", "");
  }
  for (const s of ["website", "email", "publishing", "engagement", "sales"]) {
    out.push(`## ${SECTION_LABELS[s]}`, "", "| Metric | Value | Previous | Change |", "| --- | ---: | ---: | ---: |");
    for (const k of report[s].kpis) out.push(`| ${md(k.label)} | ${formatValue(k.value, k.format)} | ${formatValue(k.previous, k.format)} | ${formatChange(k.change) ?? "—"} |`);
    out.push("");
  }
  if (report.sales.paid.length) out.push("Paid: " + report.sales.paid.map((x) => formatMoney(x.totalMinor, x.currency)).join(", "), "");
  if (report.gaps.length) out.push("## Data gaps", "", ...report.gaps.map((g) => `- ${md(g.message)}`), "");
  return out.join("\n");
}
