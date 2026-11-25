import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { getAnalytics } from "@/modules/analytics/service.js";
import { analyticsQuerySchema } from "@/modules/analytics/schemas.js";

/** Computed metrics for `?days=7|30|90&businessId=` (any member). */
export const GET = route({}, async ({ user, params, request }) => {
  const query = parseWith(analyticsQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
  return ok(await getAnalytics(user, params.workspaceId, query));
});
