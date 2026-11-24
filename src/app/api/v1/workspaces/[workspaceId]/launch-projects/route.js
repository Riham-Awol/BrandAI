import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { createLaunchProject, listLaunchProjects } from "@/modules/launch/service.js";
import { createLaunchProjectSchema } from "@/modules/launch/schemas.js";

export const GET = route({}, async ({ user, params }) => ok(await listLaunchProjects(user, params.workspaceId)));

export const POST = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(createLaunchProjectSchema, await json());
  return ok(await createLaunchProject(user, params.workspaceId, input, requestInfo), { status: 201 });
});
