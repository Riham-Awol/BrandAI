import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { acceptInvitation } from "@/server/workspaces/team-service.js";
import { inviteTokenSchema } from "@/validation/team.js";

/** Accepts an invitation as the signed-in person (email must match). */
export const POST = route({}, async ({ user, json, requestInfo }) => ok(await acceptInvitation(user, parseWith(inviteTokenSchema, await json()).token, requestInfo)));
