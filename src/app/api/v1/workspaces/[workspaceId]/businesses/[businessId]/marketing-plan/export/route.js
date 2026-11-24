import { route } from "@/server/http/route-handler.js";
import { exportApprovedPlan } from "@/modules/strategy/plan-service.js";
import { fileResponse, readFormat } from "@/modules/strategy/export-route.js";

export const GET = route({}, async ({ user, params, request }) => fileResponse(await exportApprovedPlan(user, params.workspaceId, params.businessId, readFormat(request))));
