import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { deleteLaunchProject, getLaunchProject, updateLaunchProject } from "@/modules/launch/service.js";
import { updateLaunchProjectSchema } from "@/modules/launch/schemas.js";

export const GET = route({}, async ({ user, params }) => ok(await getLaunchProject(user, params.workspaceId, params.projectId)));

export const PATCH = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(updateLaunchProjectSchema, await json());
  return ok(await updateLaunchProject(user, params.workspaceId, params.projectId, input, requestInfo));
});

export const DELETE = route({}, async ({ user, params, requestInfo }) => {
  await deleteLaunchProject(user, params.workspaceId, params.projectId, requestInfo);
  return ok({ deleted: true });
});
