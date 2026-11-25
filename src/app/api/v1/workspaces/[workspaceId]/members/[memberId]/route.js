import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { changeMemberRole, removeMember } from "@/server/workspaces/team-service.js";
import { roleSchema } from "@/validation/team.js";

export const PATCH = route({}, async ({ user, params, json, requestInfo }) => ok(await changeMemberRole(user, params.workspaceId, params.memberId, parseWith(roleSchema, await json()), requestInfo)));
export const DELETE = route({}, async ({ user, params, requestInfo }) => ok(await removeMember(user, params.workspaceId, params.memberId, requestInfo)));
