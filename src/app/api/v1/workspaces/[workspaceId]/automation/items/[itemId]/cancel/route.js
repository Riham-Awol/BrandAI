import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { cancelItem } from "@/modules/automation/queue-service.js";

export const POST = route({}, async ({ user, params, requestInfo }) => ok(await cancelItem(user, params.workspaceId, params.itemId, requestInfo)));
