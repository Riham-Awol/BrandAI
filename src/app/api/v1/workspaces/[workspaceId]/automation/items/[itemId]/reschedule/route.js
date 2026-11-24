import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { rescheduleItem } from "@/modules/automation/queue-service.js";
import { rescheduleSchema } from "@/modules/automation/schemas.js";

export const POST = route({}, async ({ user, params, json, requestInfo }) => ok(await rescheduleItem(user, params.workspaceId, params.itemId, parseWith(rescheduleSchema, await json()).scheduledAt, requestInfo)));
