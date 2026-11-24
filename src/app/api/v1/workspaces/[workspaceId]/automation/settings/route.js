import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { getAutomationSettings, saveAutomationSettings } from "@/modules/automation/settings-service.js";
import { settingsSchema } from "@/modules/automation/schemas.js";

export const GET = route({}, async ({ user, params }) => ok(await getAutomationSettings(user, params.workspaceId)));

/** Mode and limits (automation:manage; switching ON authorized automation: owner only). */
export const PUT = route({}, async ({ user, params, json, requestInfo }) => ok(await saveAutomationSettings(user, params.workspaceId, parseWith(settingsSchema, await json()), requestInfo)));
