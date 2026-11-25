import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { getAnalyticsSettings, saveAnalyticsSettings } from "@/modules/analytics/service.js";
import { analyticsSettingsSchema } from "@/modules/analytics/schemas.js";

/** Tracking and retention choices; changing them needs analytics:manage (admins, owner). */
export const GET = route({}, async ({ user, params }) => ok(await getAnalyticsSettings(user, params.workspaceId)));
export const PUT = route({}, async ({ user, params, json, requestInfo }) => ok(await saveAnalyticsSettings(user, params.workspaceId, parseWith(analyticsSettingsSchema, await json()), requestInfo)));
