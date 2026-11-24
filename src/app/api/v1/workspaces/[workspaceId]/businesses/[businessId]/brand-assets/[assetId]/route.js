import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { deleteBrandAsset } from "@/modules/brand/assets-service.js";

export const DELETE = route({}, async ({ user, params, requestInfo }) => {
  await deleteBrandAsset(user, params.workspaceId, params.businessId, params.assetId, requestInfo);
  return ok({ deleted: true });
});
