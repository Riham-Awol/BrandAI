import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { createCompanyProfile, listCompanyProfiles } from "@/modules/stationery/profile-service.js";
import { createProfileSchema } from "@/modules/stationery/profile-schemas.js";

export const GET = route({}, async ({ user, params }) => ok(await listCompanyProfiles(user, params.workspaceId)));

export const POST = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(createProfileSchema, await json());
  return ok(await createCompanyProfile(user, params.workspaceId, input, requestInfo), { status: 201 });
});
