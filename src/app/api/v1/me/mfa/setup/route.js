import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { startMfaSetup } from "@/server/account/service.js";

export const POST = route({}, async ({ user }) => ok(await startMfaSetup(user)));
