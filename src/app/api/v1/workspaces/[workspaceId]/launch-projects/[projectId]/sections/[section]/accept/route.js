import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { acceptSectionVersion } from "@/modules/launch/service.js";
import { acceptOutputSchema } from "@/modules/launch/schemas.js";

export const POST = route({}, async ({ user, params, json, requestInfo }) => {
  const { outputId } = parseWith(acceptOutputSchema, await json());
  return ok(await acceptSectionVersion(user, params.workspaceId, params.projectId, params.section, outputId, requestInfo));
});
