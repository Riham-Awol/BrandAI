import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { getBusinessDetails, saveBusinessDetails } from "@/modules/stationery/details-service.js";
import { businessDetailsSchema } from "@/modules/stationery/details.js";

/** Company details for stationery, invoices and quotations. */
export const GET = route({}, async ({ user, params }) => ok(await getBusinessDetails(user, params.workspaceId, params.businessId)));

export const PUT = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(businessDetailsSchema, await json());
  return ok(await saveBusinessDetails(user, params.workspaceId, params.businessId, input, requestInfo));
});
