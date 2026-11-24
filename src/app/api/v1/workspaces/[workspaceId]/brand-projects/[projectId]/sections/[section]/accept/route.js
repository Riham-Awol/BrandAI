import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { brandEngine } from "@/modules/brand/service.js";
import { acceptOutputSchema } from "@/modules/launch/schemas.js";

export const POST = route({}, async ({ user, params, json, requestInfo }) => {
  const { outputId } = parseWith(acceptOutputSchema, await json());
  return ok(await brandEngine.acceptSectionVersion(user, params.workspaceId, params.projectId, params.section, outputId, requestInfo));
});
