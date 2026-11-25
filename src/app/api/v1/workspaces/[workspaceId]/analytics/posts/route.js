import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { listPostsForMetrics } from "@/modules/analytics/service.js";
import { analyticsQuerySchema } from "@/modules/analytics/schemas.js";

/** Published posts of the period with their entered results. */
export const GET = route({}, async ({ user, params, request }) => ok(await listPostsForMetrics(user, params.workspaceId, parseWith(analyticsQuerySchema, Object.fromEntries(new URL(request.url).searchParams)))));
