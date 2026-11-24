import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { submitItem } from "@/modules/automation/queue-service.js";

export const POST = route({}, async ({ user, params, requestInfo }) => ok(await submitItem(user, params.workspaceId, params.itemId, requestInfo)));
