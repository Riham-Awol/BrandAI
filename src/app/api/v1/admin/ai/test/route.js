import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { testAi } from "@/server/platform/admin-service.js";

export const maxDuration = 300;
export const POST = route({}, async ({ user, requestInfo }) => ok(await testAi(user, requestInfo)));
