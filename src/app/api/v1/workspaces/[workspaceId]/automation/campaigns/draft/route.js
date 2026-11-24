import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { draftCampaign } from "@/modules/automation/campaigns-service.js";
import { campaignDraftSchema } from "@/modules/automation/schemas.js";

export const maxDuration = 300;

/** AI-written subject and body (not saved). */
export const POST = route({}, async ({ user, params, json, requestInfo }) => ok(await draftCampaign(user, params.workspaceId, parseWith(campaignDraftSchema, await json()), requestInfo)));
