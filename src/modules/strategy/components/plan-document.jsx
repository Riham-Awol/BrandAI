import { humanize } from "@/lib/humanize";
import { schemaToSpec } from "@/components/structured/schema-spec";
import { StructuredView } from "@/components/structured/structured-view";
import { GOAL_LABELS, SECTION_SCHEMAS } from "../schemas.js";
import { STRATEGY_SECTIONS } from "../sections.js";
import { BudgetView } from "./budget-view";
import { PersonaCards } from "./persona-cards";

const SPECS = Object.fromEntries(Object.entries(SECTION_SCHEMAS).map(([k, s]) => [k, schemaToSpec(s)]));
const ORDER = ["strategy", ...STRATEGY_SECTIONS.map((s) => s.key).filter((k) => k !== "strategy")];
const TITLES = Object.fromEntries(STRATEGY_SECTIONS.map((s) => [s.key, s.title]));

/** Full marketing plan (used for the printable page and the review step). */
export function PlanDocument({ data }) {
  const { sections, settings } = data;
  return (
    <div className="space-y-10">
      <dl className="grid gap-3 sm:grid-cols-3">
        {[["Goal", GOAL_LABELS[settings?.primaryGoal] ?? humanize(settings?.primaryGoal ?? "")], ["Timeframe", `${settings?.timeframeMonths} months`], ["Currency", data.budget?.currency ?? settings?.currency]].map(([k, v]) => (
          <div key={k} className="rounded-xl border bg-card p-4"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-semibold">{v}</dd></div>
        ))}
      </dl>
      {ORDER.filter((k) => sections[k]).map((key) => (
        <section key={key} className="space-y-4 break-inside-avoid border-t pt-8">
          <h2 className="text-2xl font-semibold">{TITLES[key]}</h2>
          {key === "personas" ? (
            <PersonaCards personas={sections.personas.personas} />
          ) : key === "budget" ? (
            <BudgetView content={sections.budget} statedMonthly={settings?.monthlyBudget} spec={SPECS.budget} />
          ) : (
            <StructuredView spec={SPECS[key]} value={sections[key]} />
          )}
        </section>
      ))}
    </div>
  );
}
