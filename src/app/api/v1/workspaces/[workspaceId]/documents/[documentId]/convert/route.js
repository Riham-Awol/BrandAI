import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { convertQuoteToInvoice } from "@/modules/stationery/documents-service.js";

/** Turns a sent/accepted quotation into a draft invoice (idempotent). */
export const POST = route({}, async ({ user, params, requestInfo }) => ok(await convertQuoteToInvoice(user, params.workspaceId, params.documentId, requestInfo), { status: 201 }));
