import { route } from "@/server/http/route-handler.js";
import { DESIGN_SVG_HEADERS } from "@/server/design/renderer.js";
import { renderDesign } from "@/modules/design/service.js";

/** Saved design as SVG (`?format=` renders another size, `&download=1` downloads). */
export const GET = route({}, async ({ user, params, request }) => {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? undefined;
  const { svg, design } = await renderDesign(user, params.workspaceId, params.designId, { format });
  const headers = { ...DESIGN_SVG_HEADERS };
  if (url.searchParams.get("download") === "1") {
    const slug = design.name.replace(/[^\w-]+/g, "-").replace(/-+/g, "-").toLowerCase().slice(0, 60) || "design";
    headers["Content-Disposition"] = `attachment; filename="${slug}-${format ?? design.format}.svg"`;
  }
  return new Response(svg, { headers });
});
