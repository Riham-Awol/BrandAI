import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { Errors } from "@/server/errors.js";
import { handleStripeWebhook } from "@/server/billing/service.js";

/** Stripe → Brand AI. Authenticated by the Stripe-Signature header over the raw body. */
export const POST = route({ auth: false, rateLimit: false }, async ({ request }) => {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 1_000_000) throw Errors.validation({ _: ["Payload too large."] });
  const raw = await request.text();
  return ok(await handleStripeWebhook(raw, request.headers.get("stripe-signature")));
});
