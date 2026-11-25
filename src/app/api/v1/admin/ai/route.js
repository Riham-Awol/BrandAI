import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { getAiAdministration } from "@/server/platform/admin-service.js";

export const GET = route({}, async ({ user }) => ok(await getAiAdministration(user)));
