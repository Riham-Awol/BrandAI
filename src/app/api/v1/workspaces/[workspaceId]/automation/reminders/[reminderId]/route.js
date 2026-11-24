import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { z } from "zod";
import { deleteReminder, updateReminder } from "@/modules/automation/reminders-service.js";

const schema = z.object({ done: z.boolean() });

export const PATCH = route({}, async ({ user, params, json }) => {
  await updateReminder(user, params.workspaceId, params.reminderId, parseWith(schema, await json()));
  return ok({ updated: true });
});

export const DELETE = route({}, async ({ user, params }) => {
  await deleteReminder(user, params.workspaceId, params.reminderId);
  return ok({ deleted: true });
});
