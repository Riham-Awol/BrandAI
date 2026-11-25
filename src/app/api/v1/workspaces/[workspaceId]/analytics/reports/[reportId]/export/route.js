import { z } from "zod";
import { parseWith, route } from "@/server/http/route-handler.js";
import { getReport } from "@/modules/analytics/service.js";
import { reportToCsv, reportToMarkdown } from "@/modules/analytics/export.js";

const schema = z.object({ format: z.enum(["csv", "md"]).default("md") });

/** Downloads a saved report (metrics snapshot + insights). */
export const GET = route({}, async ({ user, params, request }) => {
  const { format } = parseWith(schema, Object.fromEntries(new URL(request.url).searchParams));
  const r = await getReport(user, params.workspaceId, params.reportId);
  const businessName = r.business ?? "All businesses";
  const body = format === "csv" ? reportToCsv(r.metrics, { businessName }) : reportToMarkdown(r.metrics, { businessName, insights: r.insights, createdAt: r.createdAt });
  return new Response(body, {
    headers: {
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="brand-ai-report-${new Date(r.createdAt).toISOString().slice(0, 10)}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
});
