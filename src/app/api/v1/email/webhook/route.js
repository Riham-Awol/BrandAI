import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { Errors } from "@/server/errors.js";
import { handleEmailWebhook } from "@/modules/automation/bounce-service.js";

/** Resend webhook (bounces, complaints). Authenticated by the Svix signature over the raw body. */
export const POST = route({ auth: false, rateLimit: false }, async ({ request }) => {
  if (Number(request.headers.get("content-length") ?? 0) > 1_000_000) throw Errors.validation({ _: ["Payload too large."] });
  return ok(await handleEmailWebhook(await request.text(), request.headers));
});
