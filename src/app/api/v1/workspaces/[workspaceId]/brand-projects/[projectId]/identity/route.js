import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { approveIdentity, getIdentityOverview } from "@/modules/brand/identity-service.js";

export const GET = route({}, async ({ user, params }) => ok(await getIdentityOverview(user, params.workspaceId, params.projectId)));

/** Approves the assembled brand identity (admins/owners). */
export const POST = route({}, async ({ user, params, requestInfo }) => ok(await approveIdentity(user, params.workspaceId, params.projectId, requestInfo), { status: 201 }));
