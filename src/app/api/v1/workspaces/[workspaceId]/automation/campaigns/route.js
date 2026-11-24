import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { createCampaign, listCampaigns } from "@/modules/automation/campaigns-service.js";
import { campaignSchema } from "@/modules/automation/schemas.js";

export const GET = route({}, async ({ user, params }) => ok(await listCampaigns(user, params.workspaceId)));
export const POST = route({}, async ({ user, params, json, requestInfo }) => ok(await createCampaign(user, params.workspaceId, parseWith(campaignSchema, await json()), requestInfo), { status: 201 }));
