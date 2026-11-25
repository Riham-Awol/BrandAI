import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { sendVerificationEmail } from "@/server/account/service.js";

export const POST = route({}, async ({ user, requestInfo }) => ok(await sendVerificationEmail(user, requestInfo)));
