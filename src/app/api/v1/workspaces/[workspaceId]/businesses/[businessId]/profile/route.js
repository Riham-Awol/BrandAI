import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { getBusinessProfile, saveBusinessProfile } from "@/server/businesses/profile-service.js";
import { businessProfileSchema } from "@/validation/profile.js";

export const GET = route({}, async ({ user, params }) => ok(await getBusinessProfile(user, params.workspaceId, params.businessId)));

export const PUT = route({}, async ({ user, params, json, requestInfo }) => {
  const profile = parseWith(businessProfileSchema, await json());
  return ok(await saveBusinessProfile(user, params.workspaceId, params.businessId, profile, requestInfo));
});
