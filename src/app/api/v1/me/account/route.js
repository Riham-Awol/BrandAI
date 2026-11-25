import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { getAccount, updateProfile } from "@/server/account/service.js";
import { profileSchema } from "@/validation/account.js";

export const GET = route({}, async ({ user }) => ok(await getAccount(user)));
export const PATCH = route({}, async ({ user, json, requestInfo }) => ok(await updateProfile(user, parseWith(profileSchema, await json()), requestInfo)));
