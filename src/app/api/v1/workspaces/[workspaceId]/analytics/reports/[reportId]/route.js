import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { deleteReport, getReport } from "@/modules/analytics/service.js";

export const GET = route({}, async ({ user, params }) => ok(await getReport(user, params.workspaceId, params.reportId)));
export const DELETE = route({}, async ({ user, params, requestInfo }) => ok(await deleteReport(user, params.workspaceId, params.reportId, requestInfo)));
