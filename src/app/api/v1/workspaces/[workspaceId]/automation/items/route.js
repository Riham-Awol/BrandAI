import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { listItems, scheduleItem } from "@/modules/automation/queue-service.js";
import { scheduleSchema } from "@/modules/automation/schemas.js";

/** Queue (`?from=&to=&status=A,B`). */
export const GET = route({}, async ({ user, params, request }) => {
  const q = new URL(request.url).searchParams;
  return ok(await listItems(user, params.workspaceId, { from: q.get("from") ?? undefined, to: q.get("to") ?? undefined, status: q.get("status") ?? undefined }));
});

/** Schedules a post, campaign or custom item; `submit` applies the approval policy. */
export const POST = route({}, async ({ user, params, json, requestInfo }) => ok(await scheduleItem(user, params.workspaceId, parseWith(scheduleSchema, await json()), requestInfo), { status: 201 }));
