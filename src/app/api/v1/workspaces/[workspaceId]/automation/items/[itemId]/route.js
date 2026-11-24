import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { getItem } from "@/modules/automation/queue-service.js";

export const GET = route({}, async ({ user, params }) => ok(await getItem(user, params.workspaceId, params.itemId)));
