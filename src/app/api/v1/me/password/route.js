import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { changePassword } from "@/server/account/service.js";
import { changePasswordSchema } from "@/validation/account.js";

/** Changes the password; every session (including this one) is signed out. */
export const POST = route({}, async ({ user, json, requestInfo }) => ok(await changePassword(user, parseWith(changePasswordSchema, await json()), requestInfo)));
