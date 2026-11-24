import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { createBrandProject, listBrandProjects } from "@/modules/brand/service.js";
import { createBrandProjectSchema } from "@/modules/brand/schemas.js";

export const GET = route({}, async ({ user, params }) => ok(await listBrandProjects(user, params.workspaceId)));

export const POST = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(createBrandProjectSchema, await json());
  return ok(await createBrandProject(user, params.workspaceId, input, requestInfo), { status: 201 });
});
