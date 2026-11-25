import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { openBillingPortal } from "@/server/billing/service.js";

export const POST = route({}, async ({ user, params }) => ok(await openBillingPortal(user, params.workspaceId)));
