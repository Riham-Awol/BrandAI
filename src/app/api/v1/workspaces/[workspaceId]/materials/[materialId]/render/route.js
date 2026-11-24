import { route } from "@/server/http/route-handler.js";
import { MATERIAL_SVG_HEADERS } from "@/server/stationery/renderer.js";
import { renderMaterialView } from "@/modules/stationery/materials-service.js";

/** One view as SVG: `?view=front|back|page|mockup|artwork|label|dieline`, `&download=1`. */
export const GET = route({}, async ({ user, params, request }) => {
  const url = new URL(request.url);
  const { view, material } = await renderMaterialView(user, params.workspaceId, params.materialId, url.searchParams.get("view") ?? undefined);
  const headers = { ...MATERIAL_SVG_HEADERS };
  if (url.searchParams.get("download") === "1") {
    const slug = material.name.replace(/[^\w-]+/g, "-").replace(/-+/g, "-").toLowerCase().slice(0, 60) || "material";
    headers["Content-Disposition"] = `attachment; filename="${slug}-${view.key}.svg"`;
  }
  return new Response(view.svg, { headers });
});
