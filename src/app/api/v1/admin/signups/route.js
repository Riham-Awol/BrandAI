import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { setSignupsOpen } from "@/server/platform/admin-service.js";
import { signupsSchema } from "@/validation/admin.js";

export const PUT = route({}, async ({ user, json, requestInfo }) => ok(await setSignupsOpen(user, parseWith(signupsSchema, await json()), requestInfo)));
