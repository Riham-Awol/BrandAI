import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { enableMfa } from "@/server/account/service.js";
import { mfaCodeSchema } from "@/validation/account.js";

export const POST = route({ rateLimit: "login" }, async ({ user, json, requestInfo }) => ok(await enableMfa(user, parseWith(mfaCodeSchema, await json()), requestInfo)));
