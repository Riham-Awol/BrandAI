import { AlertTriangle, Lightbulb, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { allKpis } from "../metrics.js";

const PRIORITY = { high: ["High priority", "warning"], medium: ["Medium", "secondary"], low: ["Low", "secondary"] };
const SENTIMENT = { positive: TrendingUp, negative: TrendingDown, neutral: Minus };

function Unverified() {
  return (
    <p className="mt-1 flex items-center gap-1.5 text-xs text-warning">
      <AlertTriangle className="size-3.5 shrink-0 text-warning" aria-hidden="true" />
      Contains a number we couldn&apos;t match to your data — check it before acting.
    </p>
  );
}

/** Saved AI insights (no hooks: also used on the print page). */
export function InsightsView({ insights, metrics, isMock }) {
  const labels = Object.fromEntries(allKpis(metrics).map((k) => [k.key, k.label]));
  const chips = (keys) => keys.length > 0 && (
    <div className="mt-2 flex flex-wrap gap-1">{keys.map((k) => <span key={k} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{labels[k] ?? k}</span>)}</div>
  );
  return (
    <div className="space-y-5">
      {isMock && <p className="rounded-lg border border-dashed p-2 text-xs text-muted-foreground">Mock AI output (test mode) — not a real analysis.</p>}
      <div>
        <p className="text-base leading-relaxed">{insights.summary}</p>
        {insights.summaryVerified === false && <Unverified />}
      </div>
      {insights.highlights.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">What happened</h3>
          <ul className="space-y-2">
            {insights.highlights.map((h, i) => {
              const Icon = SENTIMENT[h.sentiment] ?? Minus;
              return (
                <li key={i} className="flex gap-3 rounded-lg border p-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label={h.sentiment} />
                  <div className="min-w-0">
                    <p className="font-medium">{h.title}</p>
                    <p className="text-sm text-muted-foreground">{h.detail}</p>
                    {h.verified === false && <Unverified />}
                    {chips(h.metricKeys)}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Recommendations</h3>
        <ol className="space-y-2">
          {insights.recommendations.map((r, i) => (
            <li key={i} className="flex gap-3 rounded-lg border p-3">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{i + 1}. {r.title}</p>
                  <Badge variant={PRIORITY[r.priority]?.[1] ?? "secondary"}>{PRIORITY[r.priority]?.[0] ?? r.priority}</Badge>
                </div>
                <p className="mt-1 text-sm">{r.action}</p>
                <p className="mt-1 text-sm text-muted-foreground"><span className="font-medium">Why: </span>{r.why}</p>
                {r.verified === false && <Unverified />}
                {chips(r.metricKeys)}
              </div>
            </li>
          ))}
        </ol>
      </section>
      {insights.dataGaps?.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-sm font-semibold">To get better insights</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{insights.dataGaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
        </section>
      )}
      <p className="text-xs text-muted-foreground">Written by AI from the numbers on this page; the numbers themselves are calculated by Brand AI from your data.</p>
    </div>
  );
}
