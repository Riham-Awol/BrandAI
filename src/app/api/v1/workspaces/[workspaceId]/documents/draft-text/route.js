import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { draftDocumentText } from "@/modules/stationery/documents-service.js";
import { draftTextSchema } from "@/modules/stationery/documents.js";

export const maxDuration = 300;

/** AI-written intro, notes and terms (no numbers). Not saved. */
export const POST = route({}, async ({ user, params, json, requestInfo }) => ok(await draftDocumentText(user, params.workspaceId, parseWith(draftTextSchema, await json()), requestInfo)));
