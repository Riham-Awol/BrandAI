import { route } from "@/server/http/route-handler.js";
import { SVG_HEADERS } from "@/server/brand/logo-renderer.js";
import { parseLogoQuery, renderApprovedLogo } from "@/modules/brand/logo-service.js";

/** Approved logo as SVG. Add &download=1 to download. */
export const GET = route({}, async ({ user, params, request }) => {
  const url = new URL(request.url);
  const options = parseLogoQuery(url.searchParams);
  const { svg, business } = await renderApprovedLogo(user, params.workspaceId, params.businessId, options);
  const headers = { ...SVG_HEADERS };
  if (url.searchParams.get("download") === "1") {
    const slug = business.name.replace(/[^\w-]+/g, "-").toLowerCase() || "logo";
    headers["Content-Disposition"] = `attachment; filename="${slug}-logo-${options.variant}-${options.theme}.svg"`;
  }
  return new Response(svg, { headers });
});
