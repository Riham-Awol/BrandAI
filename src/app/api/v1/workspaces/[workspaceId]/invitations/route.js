import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { inviteMember } from "@/server/workspaces/team-service.js";
import { inviteSchema } from "@/validation/team.js";

export const POST = route({}, async ({ user, params, json, requestInfo }) => ok(await inviteMember(user, params.workspaceId, parseWith(inviteSchema, await json()), requestInfo), { status: 201 }));
