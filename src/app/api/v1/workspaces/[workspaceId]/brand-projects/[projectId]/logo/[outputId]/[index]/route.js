import { route } from "@/server/http/route-handler.js";
import { SVG_HEADERS } from "@/server/brand/logo-renderer.js";
import { parseLogoQuery, renderProjectConcept } from "@/modules/brand/logo-service.js";

/** SVG of one logo concept: ?variant=horizontal|stacked|mark|wordmark&theme=color|mono|inverse */
export const GET = route({}, async ({ user, params, request }) => {
  const options = parseLogoQuery(new URL(request.url).searchParams);
  const { svg } = await renderProjectConcept(user, params.workspaceId, params.projectId, params.outputId, params.index, options);
  return new Response(svg, { headers: SVG_HEADERS });
});
