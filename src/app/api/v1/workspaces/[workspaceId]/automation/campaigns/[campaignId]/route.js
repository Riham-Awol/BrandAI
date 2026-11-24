import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { deleteCampaign, getCampaign, updateCampaign } from "@/modules/automation/campaigns-service.js";
import { campaignUpdateSchema } from "@/modules/automation/schemas.js";

export const GET = route({}, async ({ user, params }) => ok(await getCampaign(user, params.workspaceId, params.campaignId)));
export const PUT = route({}, async ({ user, params, json, requestInfo }) => ok(await updateCampaign(user, params.workspaceId, params.campaignId, parseWith(campaignUpdateSchema, await json()), requestInfo)));
export const DELETE = route({}, async ({ user, params, requestInfo }) => {
  await deleteCampaign(user, params.workspaceId, params.campaignId, requestInfo);
  return ok({ deleted: true });
});
