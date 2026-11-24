import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { deleteBusiness, getBusiness, updateBusiness } from "@/server/businesses/service.js";
import { updateBusinessSchema } from "@/validation/business.js";

export const GET = route({}, async ({ user, params }) => ok(await getBusiness(user, params.workspaceId, params.businessId)));

export const PATCH = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(updateBusinessSchema, await json());
  return ok(await updateBusiness(user, params.workspaceId, params.businessId, input, requestInfo));
});

export const DELETE = route({}, async ({ user, params, requestInfo }) => {
  await deleteBusiness(user, params.workspaceId, params.businessId, requestInfo);
  return ok({ deleted: true });
});
