import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { addContact, listContacts } from "@/modules/automation/contacts-service.js";
import { contactSchema } from "@/modules/automation/schemas.js";

/** Audience of a business (`?businessId=`); editors and above (personal data). */
export const GET = route({}, async ({ user, params, request }) => ok(await listContacts(user, params.workspaceId, new URL(request.url).searchParams.get("businessId") ?? "")));
export const POST = route({}, async ({ user, params, json, requestInfo }) => ok(await addContact(user, params.workspaceId, parseWith(contactSchema, await json()), requestInfo), { status: 201 }));
