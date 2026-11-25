import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { listReports } from "@/modules/analytics/service.js";

export const GET = route({}, async ({ user, params, request }) => ok(await listReports(user, params.workspaceId, { businessId: new URL(request.url).searchParams.get("businessId") || undefined })));
