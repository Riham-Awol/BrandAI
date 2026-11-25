import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { disableMfa } from "@/server/account/service.js";
import { disableMfaSchema } from "@/validation/account.js";

export const POST = route({ rateLimit: "login" }, async ({ user, json, requestInfo }) => ok(await disableMfa(user, parseWith(disableMfaSchema, await json()), requestInfo)));
