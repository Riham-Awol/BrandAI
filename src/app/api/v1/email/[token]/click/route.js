import { NextResponse } from "next/server";
import { route } from "@/server/http/route-handler.js";
import { enforceRateLimit } from "@/server/rate-limit/index.js";
import { getEnv } from "@/server/config/env.js";
import { logger } from "@/server/logger.js";
import { recordEmailEvent } from "@/modules/analytics/tracking-service.js";

/**
 * Click redirect of a campaign email. The destination is the campaign's stored
 * https link, looked up from the signed delivery token: never a URL from the
 * request, so this can't be used as an open redirect.
 */
export const GET = route({ auth: false, rateLimit: false }, async ({ request, params, requestInfo }) => {
  let result = null;
  try {
    // Over the limit: still redirect, just don't count the click.
    const counted = await enforceRateLimit("tracking", `ip:${requestInfo.ip}`).then(() => true, () => false);
    result = await recordEmailEvent(params.token, "click", { headers: request.headers, record: counted });
  } catch (error) {
    logger.warn("Email click not recorded", { code: error?.code });
  }
  const target = result?.ctaUrl ?? getEnv().APP_URL;
  return NextResponse.redirect(target, 302);
});
