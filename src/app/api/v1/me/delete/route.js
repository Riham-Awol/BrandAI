import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { deleteAccount } from "@/server/account/service.js";
import { deleteAccountSchema } from "@/validation/account.js";

/** Permanently closes the signed-in account (password + typed confirmation). */
export const POST = route({ rateLimit: "login" }, async ({ user, json, requestInfo }) => ok(await deleteAccount(user, parseWith(deleteAccountSchema, await json()), requestInfo)));
