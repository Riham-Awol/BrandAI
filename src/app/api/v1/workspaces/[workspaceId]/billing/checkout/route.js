import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { startCheckout } from "@/server/billing/service.js";
import { checkoutSchema } from "@/validation/team.js";

/** Owner only (billing:manage): returns a Stripe Checkout URL for a plan. */
export const POST = route({}, async ({ user, params, json, requestInfo }) => ok(await startCheckout(user, params.workspaceId, parseWith(checkoutSchema, await json()), requestInfo)));
