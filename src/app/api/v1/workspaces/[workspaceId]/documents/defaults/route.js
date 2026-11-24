import { z } from "zod";
import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { getDocumentDefaults } from "@/modules/stationery/documents-service.js";

const query = z.object({ businessId: z.uuid(), type: z.enum(["INVOICE", "QUOTE"]) });

/** Currency, tax rate and dates for a new document from the business details. */
export const GET = route({}, async ({ user, params, request }) => {
  const { businessId, type } = parseWith(query, Object.fromEntries(new URL(request.url).searchParams));
  return ok(await getDocumentDefaults(user, params.workspaceId, businessId, type));
});
