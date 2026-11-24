import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { approvePlan, getPlanOverview } from "@/modules/strategy/plan-service.js";

export const GET = route({}, async ({ user, params }) => ok(await getPlanOverview(user, params.workspaceId, params.projectId)));

/** Approves the assembled marketing plan (admins/owners). */
export const POST = route({}, async ({ user, params, requestInfo }) => ok(await approvePlan(user, params.workspaceId, params.projectId, requestInfo), { status: 201 }));
