import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { getWorkspaceSettings, renameWorkspace } from "@/server/workspaces/team-service.js";
import { deleteWorkspaceWithBilling } from "@/server/billing/service.js";
import { deleteWorkspaceSchema, renameWorkspaceSchema } from "@/validation/team.js";

export const GET = route({}, async ({ user, params }) => ok(await getWorkspaceSettings(user, params.workspaceId)));
export const PATCH = route({}, async ({ user, params, json, requestInfo }) => ok(await renameWorkspace(user, params.workspaceId, parseWith(renameWorkspaceSchema, await json()), requestInfo)));
/** Deletes a team/agency workspace (owner; typed name; a paid plan is cancelled first). */
export const DELETE = route({}, async ({ user, params, json, requestInfo }) => ok(await deleteWorkspaceWithBilling(user, params.workspaceId, parseWith(deleteWorkspaceSchema, await json()), requestInfo)));
