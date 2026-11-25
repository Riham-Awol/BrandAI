import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { savePostMetrics } from "@/modules/analytics/service.js";
import { postMetricsSchema } from "@/modules/analytics/schemas.js";

/** Saves a published post's results (editors and above). */
export const PUT = route({}, async ({ user, params, json, requestInfo }) => ok(await savePostMetrics(user, params.workspaceId, params.itemId, parseWith(postMetricsSchema, await json()), requestInfo)));
