import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { generateInsights } from "@/modules/analytics/service.js";
import { insightsRequestSchema } from "@/modules/analytics/schemas.js";

export const maxDuration = 300;

/** AI insights for the current numbers; saved as a report. */
export const POST = route({}, async ({ user, params, json, requestInfo }) => ok(await generateInsights(user, params.workspaceId, parseWith(insightsRequestSchema, await json()), requestInfo), { status: 201 }));
