import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { deleteDocument, getDocument, updateDocument } from "@/modules/stationery/documents-service.js";
import { documentUpdateSchema } from "@/modules/stationery/documents.js";

export const GET = route({}, async ({ user, params }) => ok(await getDocument(user, params.workspaceId, params.documentId)));

/** Replaces a draft's content (409 if not a draft). */
export const PUT = route({}, async ({ user, params, json, requestInfo }) => ok(await updateDocument(user, params.workspaceId, params.documentId, parseWith(documentUpdateSchema, await json()), requestInfo)));

export const DELETE = route({}, async ({ user, params, requestInfo }) => {
  await deleteDocument(user, params.workspaceId, params.documentId, requestInfo);
  return ok({ deleted: true });
});
