import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { getUsageSummary } from "@/server/usage/service.js";

export const GET = route({}, async ({ user, params }) => ok(await getUsageSummary(user, params.workspaceId)));
