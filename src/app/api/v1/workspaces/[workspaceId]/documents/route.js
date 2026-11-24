import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { createDocument, listDocuments } from "@/modules/stationery/documents-service.js";
import { documentInputSchema } from "@/modules/stationery/documents.js";

/** Invoices and quotations (`?type=INVOICE|QUOTE`). Amounts are minor units as strings. */
export const GET = route({}, async ({ user, params, request }) => ok(await listDocuments(user, params.workspaceId, { type: new URL(request.url).searchParams.get("type") ?? undefined })));

export const POST = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(documentInputSchema, await json());
  return ok(await createDocument(user, params.workspaceId, input, requestInfo), { status: 201 });
});
