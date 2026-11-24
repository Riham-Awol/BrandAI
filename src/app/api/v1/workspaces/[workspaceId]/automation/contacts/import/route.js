import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { importContacts } from "@/modules/automation/contacts-service.js";
import { importSchema } from "@/modules/automation/schemas.js";

/** CSV import with a consent attestation. */
export const POST = route({}, async ({ user, params, json, requestInfo }) => ok(await importContacts(user, params.workspaceId, parseWith(importSchema, await json()), requestInfo)));
