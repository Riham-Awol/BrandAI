import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { verifyEmail } from "@/server/account/service.js";
import { verifyEmailSchema } from "@/validation/account.js";

/** Public: confirms an email address with the emailed token. */
export const POST = route({ auth: false, rateLimit: "passwordReset" }, async ({ json, requestInfo }) => ok(await verifyEmail(parseWith(verifyEmailSchema, await json()), requestInfo)));
