import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { duplicateMaterial } from "@/modules/stationery/materials-service.js";

export const POST = route({}, async ({ user, params, requestInfo }) => ok(await duplicateMaterial(user, params.workspaceId, params.materialId, requestInfo), { status: 201 }));
