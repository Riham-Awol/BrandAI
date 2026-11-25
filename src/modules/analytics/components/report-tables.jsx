import { formatMoney } from "@/modules/stationery/money.js";
import { formatChange, formatValue } from "../metrics.js";

const SECTIONS = [["website", "Website"], ["email", "Email"], ["engagement", "Social engagement"], ["publishing", "Publishing"], ["sales", "Sales"]];

/** Every KPI of a report snapshot as plain tables (no hooks: print-safe). */
export function ReportTables({ metrics }) {
  return (
    <div className="space-y-6">
      {SECTIONS.map(([key, title]) => (
        <section key={key} className="break-inside-avoid">
          <h2 className="mb-2 text-lg font-semibold">{title}</h2>
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="border-b text-left text-[#675f73]"><tr><th scope="col" className="py-1.5 font-medium">Metric</th><th scope="col" className="py-1.5 text-right font-medium">Value</th><th scope="col" className="py-1.5 text-right font-medium">Previous</th><th scope="col" className="py-1.5 text-right font-medium">Change</th></tr></thead>
            <tbody className="divide-y tabular-nums">
              {metrics[key].kpis.map((k) => (
                <tr key={k.key}><td className="py-1.5">{k.label}</td><td className="py-1.5 text-right">{formatValue(k.value, k.format)}</td><td className="py-1.5 text-right">{formatValue(k.previous, k.format)}</td><td className="py-1.5 text-right">{formatChange(k.change) ?? "—"}</td></tr>
              ))}
            </tbody>
          </table>
          {key === "sales" && metrics.sales.paid.length > 0 && <p className="mt-2 text-sm">Paid: {metrics.sales.paid.map((x) => formatMoney(x.totalMinor, x.currency)).join(", ")}</p>}
          {key === "website" && metrics.website.pages.length > 0 && <p className="mt-2 text-sm text-[#675f73]">Top pages: {metrics.website.pages.slice(0, 5).map((p) => `/${p.path === "home" ? "" : p.path} (${p.views})`).join(", ")}</p>}
        </section>
      ))}
      {metrics.gaps.length > 0 && (
        <section className="break-inside-avoid">
          <h2 className="mb-2 text-lg font-semibold">Data gaps</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">{metrics.gaps.map((g) => <li key={g.message}>{g.message}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
