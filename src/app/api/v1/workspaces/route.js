import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { listWorkspacesForUser } from "@/server/workspaces/service.js";
import { createWorkspace } from "@/server/workspaces/team-service.js";
import { createWorkspaceSchema } from "@/validation/team.js";

export const GET = route({}, async ({ user }) => ok(await listWorkspacesForUser(user.id)));

/** A new team or agency workspace owned by the caller (max 10 owned). */
export const POST = route({}, async ({ user, json, requestInfo }) => ok(await createWorkspace(user, parseWith(createWorkspaceSchema, await json()), requestInfo), { status: 201 }));
