import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { sendTestEmail } from "@/modules/automation/campaigns-service.js";

/** Sends a test copy to the signed-in user only. */
export const POST = route({}, async ({ user, params, requestInfo }) => ok(await sendTestEmail(user, params.workspaceId, params.campaignId, requestInfo)));
