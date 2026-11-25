import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { setAiPaused } from "@/server/platform/admin-service.js";
import { aiPauseSchema } from "@/validation/admin.js";

export const PUT = route({}, async ({ user, json, requestInfo }) => ok(await setAiPaused(user, parseWith(aiPauseSchema, await json()), requestInfo)));
