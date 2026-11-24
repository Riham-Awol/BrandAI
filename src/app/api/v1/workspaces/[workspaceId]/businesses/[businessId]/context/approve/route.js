import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { approveContextDraft } from "@/server/businesses/context-service.js";
import { approveContextSchema } from "@/validation/business.js";

export const POST = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(approveContextSchema, await json());
  return ok(await approveContextDraft(user, params.workspaceId, params.businessId, input, requestInfo));
});
