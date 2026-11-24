import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { createStrategyProject, listStrategyProjects } from "@/modules/strategy/service.js";
import { createStrategyProjectSchema } from "@/modules/strategy/schemas.js";

export const GET = route({}, async ({ user, params }) => ok(await listStrategyProjects(user, params.workspaceId)));

export const POST = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(createStrategyProjectSchema, await json());
  return ok(await createStrategyProject(user, params.workspaceId, input, requestInfo), { status: 201 });
});
