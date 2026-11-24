import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { getCurrentIdentity } from "@/modules/brand/identity-service.js";

export const GET = route({}, async ({ user, params }) => ok(await getCurrentIdentity(user, params.workspaceId, params.businessId)));
