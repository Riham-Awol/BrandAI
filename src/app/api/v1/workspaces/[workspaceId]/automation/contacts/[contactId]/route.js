import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { deleteContact } from "@/modules/automation/contacts-service.js";

export const DELETE = route({}, async ({ user, params, requestInfo }) => {
  await deleteContact(user, params.workspaceId, params.contactId, requestInfo);
  return ok({ deleted: true });
});
