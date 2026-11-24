import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { createSocialProject, listSocialProjects } from "@/modules/social/service.js";
import { createSocialProjectSchema } from "@/modules/social/schemas.js";

export const GET = route({}, async ({ user, params }) => ok(await listSocialProjects(user, params.workspaceId)));

export const POST = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(createSocialProjectSchema, await json());
  return ok(await createSocialProject(user, params.workspaceId, input, requestInfo), { status: 201 });
});
