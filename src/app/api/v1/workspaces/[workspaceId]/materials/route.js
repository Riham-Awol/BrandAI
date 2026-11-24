import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { listMaterials, saveMaterial } from "@/modules/stationery/materials-service.js";
import { saveMaterialSchema } from "@/modules/stationery/schemas.js";

export const GET = route({}, async ({ user, params }) => ok(await listMaterials(user, params.workspaceId)));

/** Saves a chosen option (version 1). */
export const POST = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(saveMaterialSchema, await json());
  return ok(await saveMaterial(user, params.workspaceId, input, requestInfo), { status: 201 });
});
