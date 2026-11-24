import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { duplicateDocument } from "@/modules/stationery/documents-service.js";

export const POST = route({}, async ({ user, params, requestInfo }) => ok(await duplicateDocument(user, params.workspaceId, params.documentId, requestInfo), { status: 201 }));
