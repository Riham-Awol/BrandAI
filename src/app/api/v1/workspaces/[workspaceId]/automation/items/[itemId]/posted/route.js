import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { markPosted } from "@/modules/automation/queue-service.js";
import { markPostedSchema } from "@/modules/automation/schemas.js";

/** Confirms a manually posted item. */
export const POST = route({}, async ({ user, params, json, requestInfo }) => ok(await markPosted(user, params.workspaceId, params.itemId, parseWith(markPostedSchema, await json()), requestInfo)));
