import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { leaveWorkspace } from "@/server/workspaces/team-service.js";

export const POST = route({}, async ({ user, params, requestInfo }) => ok(await leaveWorkspace(user, params.workspaceId, requestInfo)));
