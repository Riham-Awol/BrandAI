import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { shareTeamWithClient } from "@/server/workspaces/agency-service.js";

export const POST = route({}, async ({ user, params, requestInfo }) => ok(await shareTeamWithClient(user, params.workspaceId, params.clientId, requestInfo)));
