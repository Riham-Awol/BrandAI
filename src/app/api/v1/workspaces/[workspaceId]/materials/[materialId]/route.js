import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { deleteMaterial, getMaterial, updateMaterial } from "@/modules/stationery/materials-service.js";
import { updateMaterialSchema } from "@/modules/stationery/schemas.js";

export const GET = route({}, async ({ user, params }) => ok(await getMaterial(user, params.workspaceId, params.materialId)));

/** Saving creates a new version. */
export const PATCH = route({}, async ({ user, params, json, requestInfo }) => ok(await updateMaterial(user, params.workspaceId, params.materialId, parseWith(updateMaterialSchema, await json()), requestInfo)));

export const DELETE = route({}, async ({ user, params, requestInfo }) => {
  await deleteMaterial(user, params.workspaceId, params.materialId, requestInfo);
  return ok({ deleted: true });
});
