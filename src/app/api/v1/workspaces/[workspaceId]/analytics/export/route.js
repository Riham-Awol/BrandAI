import { parseWith, route } from "@/server/http/route-handler.js";
import { getAnalyticsForExport } from "@/modules/analytics/service.js";
import { exportQuerySchema } from "@/modules/analytics/schemas.js";
import { reportToCsv, reportToMarkdown } from "@/modules/analytics/export.js";

/** Downloads the current metrics as CSV or Markdown. */
export const GET = route({}, async ({ user, params, request }) => {
  const { format, ...query } = parseWith(exportQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
  const { report, businessName } = await getAnalyticsForExport(user, params.workspaceId, query);
  const name = `brand-ai-report-${report.period.days}d-${report.generatedAt.slice(0, 10)}`;
  const body = format === "csv" ? reportToCsv(report, { businessName }) : reportToMarkdown(report, { businessName });
  return new Response(body, {
    headers: {
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
});
