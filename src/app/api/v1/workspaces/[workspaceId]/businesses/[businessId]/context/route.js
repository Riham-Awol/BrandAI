import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { getContextOverview, saveContextDraft } from "@/server/businesses/context-service.js";
import { saveContextDraftSchema } from "@/validation/business.js";

export const GET = route({}, async ({ user, params }) => ok(await getContextOverview(user, params.workspaceId, params.businessId)));

export const PUT = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(saveContextDraftSchema, await json());
  return ok(await saveContextDraft(user, params.workspaceId, params.businessId, input, requestInfo));
});
