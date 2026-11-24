import { timingSafeEqual } from "node:crypto";
import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { Errors } from "@/server/errors.js";
import { getEnv } from "@/server/config/env.js";
import { runAutomation } from "@/modules/automation/runner.js";

export const maxDuration = 300;

/**
 * Scheduler entry point for any external cron (GitHub Actions, Vercel Cron,
 * system cron): POST with "Authorization: Bearer <CRON_SECRET>". Without
 * CRON_SECRET configured the endpoint reports SERVICE_NOT_CONFIGURED.
 */
export const POST = route({ auth: false, rateLimit: false }, async ({ request }) => {
  const secret = getEnv().CRON_SECRET;
  if (!secret) throw Errors.notConfigured("The automation scheduler (CRON_SECRET)");
  const given = Buffer.from((request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw Errors.unauthenticated("Invalid scheduler token.");
  return ok(await runAutomation());
});
