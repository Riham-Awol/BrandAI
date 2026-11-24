import { route } from "@/server/http/route-handler.js";
import { exportPlan } from "@/modules/strategy/plan-service.js";
import { fileResponse, readFormat } from "@/modules/strategy/export-route.js";

/** ?format=markdown|budget-csv|kpis-csv */
export const GET = route({}, async ({ user, params, request }) => fileResponse(await exportPlan(user, params.workspaceId, params.projectId, readFormat(request))));
