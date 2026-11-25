import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { revokeAllSessions } from "@/server/account/service.js";

export const POST = route({}, async ({ user, requestInfo }) => ok(await revokeAllSessions(user, requestInfo)));
