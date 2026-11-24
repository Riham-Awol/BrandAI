import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { brandEngine } from "@/modules/brand/service.js";

export const GET = route({}, async ({ user, params }) => ok(await brandEngine.getProject(user, params.workspaceId, params.projectId)));

export const DELETE = route({}, async ({ user, params, requestInfo }) => {
  await brandEngine.deleteProject(user, params.workspaceId, params.projectId, requestInfo);
  return ok({ deleted: true });
});
