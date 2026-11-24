import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { createBusiness, listBusinesses } from "@/server/businesses/service.js";
import { createBusinessSchema } from "@/validation/business.js";

export const GET = route({}, async ({ user, params }) => ok(await listBusinesses(user, params.workspaceId)));

export const POST = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(createBusinessSchema, await json());
  return ok(await createBusiness(user, params.workspaceId, input, requestInfo), { status: 201 });
});
