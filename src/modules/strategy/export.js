import { mdEscape, renderStructured, toCsv } from "@/lib/markdown";
import { formatMoney } from "./budget.js";
import { GOAL_LABELS } from "./schemas.js";
import { STRATEGY_SECTIONS } from "./sections.js";

/** Marketing plan as Markdown (pure). */
export function renderPlanMarkdown(data, { version } = {}) {
  const { sections, budget, settings } = data;
  const parts = [
    `# ${mdEscape(data.businessName)} — Marketing Plan${version ? ` (v${version})` : ""}`,
    "_Generated with Brand AI Marketing Strategy Studio. AI-generated content: review before relying on it._",
    `**Goal:** ${mdEscape(GOAL_LABELS[settings?.primaryGoal] ?? settings?.primaryGoal)}  \n**Timeframe:** ${settings?.timeframeMonths} months  \n**Currency:** ${mdEscape(budget?.currency ?? settings?.currency)}`,
  ];
  if (sections.strategy) parts.push("## Marketing strategy", renderStructured(sections.strategy));
  for (const s of STRATEGY_SECTIONS.filter((x) => x.key !== "strategy")) {
    if (!sections[s.key]) continue;
    parts.push(`## ${s.title}`);
    if (s.key === "budget" && budget) {
      parts.push(
        `**Total per month:** ${formatMoney(budget.totalMonthly, budget.currency)}  \n**First year:** ${formatMoney(budget.totalFirstYear, budget.currency)}`,
        ["| Channel | Monthly | Share | Purpose |", "|---|---:|---:|---|", ...budget.allocations.map((a) => `| ${mdEscape(a.channel)} | ${formatMoney(a.monthlyAmount, budget.currency)} | ${a.share}% | ${mdEscape(a.purpose)} |`)].join("\n"),
        renderStructured({ phasing: sections.budget.phasing, assumptions: sections.budget.assumptions, lowBudgetAlternatives: sections.budget.lowBudgetAlternatives }),
      );
    } else {
      parts.push(renderStructured(sections[s.key]));
    }
  }
  return parts.join("\n\n") + "\n";
}

export function budgetCsv(budget) {
  return toCsv([
    ["Channel", `Monthly (${budget.currency})`, "Share %", "Purpose"],
    ...budget.allocations.map((a) => [a.channel, a.monthlyAmount, a.share, a.purpose]),
    ["Total", budget.totalMonthly, 100, ""],
  ]);
}

export function kpisCsv(kpis) {
  return toCsv([["KPI", "Category", "Definition", "Formula", "Target", "Frequency", "Tool"], ...kpis.kpis.map((k) => [k.name, k.category, k.definition, k.formula, k.target, k.frequency, k.tool])]);
}
