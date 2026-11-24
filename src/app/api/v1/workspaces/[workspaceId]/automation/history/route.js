import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { listHistory } from "@/modules/automation/history.js";

/** Automation history (`?outcome=SUCCESS|SKIPPED|BLOCKED|FAILED&kind=`). */
export const GET = route({}, async ({ user, params, request }) => {
  const q = new URL(request.url).searchParams;
  return ok(await listHistory(user, params.workspaceId, { outcome: q.get("outcome") ?? undefined, kind: q.get("kind") ?? undefined }));
});
