import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StructuredView } from "@/components/structured/structured-view";
import { computeBudget, formatMoney } from "../budget.js";

function Tile({ label, value, hint }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Budget: totals computed from line items, a single-series bar chart (one
 * validated hue, values as text in text tokens, per-bar hover/focus tooltip)
 * and the full table as the accessible view.
 */
export function BudgetView({ content, statedMonthly, spec }) {
  const b = computeBudget(content, { statedMonthly });
  const max = Math.max(1, ...b.allocations.map((a) => a.monthlyAmount));
  const money = (n) => formatMoney(n, b.currency);
  return (
    <div className="space-y-6">
      {b.overBudget && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>
            This allocation ({money(b.totalMonthly)}/month) is above your stated budget of {money(b.statedMonthly)}/month. Edit the amounts or regenerate with “stay within budget”.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Per month" value={money(b.totalMonthly)} hint="Sum of channel allocations" />
        <Tile label="First year" value={money(b.totalFirstYear)} hint={content.phasing?.length ? "Sum of phasing" : "12 × monthly"} />
        <Tile label="Channels funded" value={b.allocations.filter((a) => a.monthlyAmount > 0).length} hint={`of ${b.allocations.length} listed`} />
      </div>

      <figure className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
        <figcaption className="text-sm font-semibold">Monthly budget by channel ({b.currency})</figcaption>
        <ul className="space-y-2.5">
          {b.allocations.map((a, i) => (
            <li key={i} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
              <span className="truncate text-sm" title={a.channel}>{a.channel}</span>
              <div
                className="group relative flex items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                tabIndex={0}
                aria-label={`${a.channel}: ${money(a.monthlyAmount)} per month, ${a.share}%`}
              >
                <div className="h-3 min-w-0.5 rounded-r-[4px] bg-chart-bar" style={{ width: `${(a.monthlyAmount / max) * 85}%` }} />
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{money(a.monthlyAmount)} · {a.share}%</span>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-0 z-10 mb-1.5 hidden w-max max-w-64 rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-lift group-hover:block group-focus:block"
                >
                  <span className="font-semibold">{a.channel}</span> — {money(a.monthlyAmount)}/month ({a.share}%)
                  {a.purpose && <span className="block text-muted-foreground">{a.purpose}</span>}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </figure>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <caption className="sr-only">Budget allocation table</caption>
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr><th className="px-4 py-2 font-medium">Channel</th><th className="px-4 py-2 text-right font-medium">Monthly</th><th className="px-4 py-2 text-right font-medium">Share</th><th className="px-4 py-2 font-medium">Purpose</th></tr>
          </thead>
          <tbody>
            {b.allocations.map((a, i) => (
              <tr key={i} className="border-t">
                <td className="px-4 py-2">{a.channel}</td>
                <td className="px-4 py-2 text-right tabular-nums">{money(a.monthlyAmount)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{a.share}%</td>
                <td className="px-4 py-2 text-muted-foreground">{a.purpose}</td>
              </tr>
            ))}
            <tr className="border-t font-semibold"><td className="px-4 py-2">Total</td><td className="px-4 py-2 text-right tabular-nums">{money(b.totalMonthly)}</td><td className="px-4 py-2 text-right">100%</td><td /></tr>
          </tbody>
        </table>
      </div>

      {content.phasing?.length > 0 && (
        <section className="space-y-2.5">
          <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Phasing</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {content.phasing.map((p, i) => (
              <li key={i} className="rounded-xl border bg-card p-4 shadow-soft">
                <p className="text-sm text-muted-foreground">{p.period}</p>
                <p className="font-display text-xl font-semibold tabular-nums">{money(p.amount)}</p>
                <p className="text-sm">{p.focus}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <StructuredView spec={{ ...spec, fields: spec.fields.filter((f) => ["assumptions", "lowBudgetAlternatives"].includes(f.key)) }} value={content} />
    </div>
  );
}
