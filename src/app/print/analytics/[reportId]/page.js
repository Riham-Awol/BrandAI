import { Suspense } from "react";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { getReport } from "@/modules/analytics/service.js";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { InsightsView } from "@/modules/analytics/components/insights-view";
import { ReportTables } from "@/modules/analytics/components/report-tables";

/** A saved report on A4 for printing or "Save as PDF". */
export default function PrintReportPage({ params }) {
  return (
    <Suspense fallback={<p className="p-8 text-sm">Loading…</p>}>
      <Printable params={params} />
    </Suspense>
  );
}

async function Printable({ params }) {
  const { reportId } = await params;
  const user = await requireUserOrRedirect(`/print/analytics/${reportId}`);
  const { active } = await getActiveWorkspace(user.id);
  const r = await loadOr404(() => getReport(user, active?.id, reportId));
  const end = new Date(new Date(r.periodEnd).getTime() - 1);
  return (
    <div className="print-page min-h-dvh bg-[#ecebef] py-6 text-[#17151c] print:bg-white print:py-0">
      <title>{`Performance report ${new Date(r.createdAt).toISOString().slice(0, 10)}`}</title>
      <PrintToolbar backHref="/analytics/reports" />
      <article className="light mx-auto max-w-[210mm] space-y-8 bg-white px-[16mm] py-[14mm] shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header>
          <p className="text-sm text-[#675f73]">Brand AI performance report</p>
          <h1 className="font-display text-2xl font-semibold">{r.business ?? "All businesses"}</h1>
          <p className="text-sm text-[#675f73]">Last {r.periodDays} days: {new Date(r.periodStart).toLocaleDateString("en-GB", { timeZone: "UTC" })} – {end.toLocaleDateString("en-GB", { timeZone: "UTC" })}, compared with the {r.periodDays} days before. Generated {new Date(r.createdAt).toLocaleString("en-GB")}.</p>
        </header>
        <section className="break-inside-avoid-page">
          <h2 className="mb-3 text-lg font-semibold">Insights & recommendations</h2>
          <InsightsView insights={r.insights} metrics={r.metrics} isMock={r.isMock} />
        </section>
        <ReportTables metrics={r.metrics} />
      </article>
    </div>
  );
}
