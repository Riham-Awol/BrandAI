import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { getCalendar } from "@/modules/automation/calendar-service.js";

/** Calendar events between `from` and `to` (ISO, ≤ 100 days). */
export const GET = route({}, async ({ user, params, request }) => {
  const q = new URL(request.url).searchParams;
  return ok(await getCalendar(user, params.workspaceId, { from: q.get("from"), to: q.get("to") }));
});
