import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { createReminder, listReminders } from "@/modules/automation/reminders-service.js";
import { reminderSchema } from "@/modules/automation/schemas.js";

export const GET = route({}, async ({ user, params }) => ok(await listReminders(user, params.workspaceId)));
export const POST = route({}, async ({ user, params, json }) => ok(await createReminder(user, params.workspaceId, parseWith(reminderSchema, await json())), { status: 201 }));
