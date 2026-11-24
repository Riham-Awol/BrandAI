import "server-only";
import { Errors } from "@/server/errors.js";

export const EXPORT_FORMATS = ["markdown", "budget-csv", "kpis-csv"];

export function readFormat(request) {
  const format = new URL(request.url).searchParams.get("format") ?? "markdown";
  if (!EXPORT_FORMATS.includes(format)) throw Errors.validation({ format: [`Use one of: ${EXPORT_FORMATS.join(", ")}.`] });
  return format;
}

export function fileResponse({ filename, contentType, body }) {
  return new Response(body, { headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
}
