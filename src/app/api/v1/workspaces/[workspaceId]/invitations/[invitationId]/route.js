import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { revokeInvitation } from "@/server/workspaces/team-service.js";

export const DELETE = route({}, async ({ user, params, requestInfo }) => ok(await revokeInvitation(user, params.workspaceId, params.invitationId, requestInfo)));
