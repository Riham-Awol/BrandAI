import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { generateMaterialOptions } from "@/modules/stationery/materials-service.js";
import { materialBriefSchema } from "@/modules/stationery/schemas.js";

export const maxDuration = 300;

/** Three rendered options (templates for stationery; AI concepts for merch, labels, packaging). Nothing is saved. */
export const POST = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(materialBriefSchema, await json());
  return ok(await generateMaterialOptions(user, params.workspaceId, input, requestInfo));
});
