import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { setDocumentStatus } from "@/modules/stationery/documents-service.js";
import { statusSchema } from "@/modules/stationery/documents.js";

/** Status change following the allowed transitions (409 otherwise). */
export const POST = route({}, async ({ user, params, json, requestInfo }) => ok(await setDocumentStatus(user, params.workspaceId, params.documentId, parseWith(statusSchema, await json()).status, requestInfo)));
