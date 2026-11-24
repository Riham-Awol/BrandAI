import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { listSchedulableSources } from "@/modules/automation/queue-service.js";

/** Written social posts and draft campaigns of a business (`?businessId=`). */
export const GET = route({}, async ({ user, params, request }) => ok(await listSchedulableSources(user, params.workspaceId, new URL(request.url).searchParams.get("businessId") ?? "")));
