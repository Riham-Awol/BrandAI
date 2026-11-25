import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { setUserSuspended } from "@/server/platform/admin-service.js";
import { suspendSchema } from "@/validation/admin.js";

export const PATCH = route({}, async ({ user, params, json, requestInfo }) => ok(await setUserSuspended(user, params.userId, parseWith(suspendSchema, await json()), requestInfo)));
