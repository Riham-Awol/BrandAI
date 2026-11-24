import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { getCurrentPlan } from "@/modules/strategy/plan-service.js";

export const GET = route({}, async ({ user, params }) => ok(await getCurrentPlan(user, params.workspaceId, params.businessId)));
