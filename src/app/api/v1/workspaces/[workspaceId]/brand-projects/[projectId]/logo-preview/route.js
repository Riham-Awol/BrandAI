import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { logoPreviewSchema } from "@/modules/brand/schemas.js";
import { renderPreview } from "@/modules/brand/logo-service.js";

export const POST = route({}, async ({ user, params, json }) => {
  const { concept, variant, theme } = parseWith(logoPreviewSchema, await json());
  const { svg, warnings } = await renderPreview(user, params.workspaceId, params.projectId, concept, { variant, theme, height: 160 });
  return ok({ svg, warnings });
});
