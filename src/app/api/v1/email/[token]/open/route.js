import { route } from "@/server/http/route-handler.js";
import { enforceRateLimit } from "@/server/rate-limit/index.js";
import { logger } from "@/server/logger.js";
import { PIXEL_GIF } from "@/modules/analytics/tracking.js";
import { recordEmailEvent } from "@/modules/analytics/tracking-service.js";

/** Open pixel of a campaign email (signed per-delivery token). Always a 1×1 GIF. */
export const GET = route({ auth: false, rateLimit: false }, async ({ request, params, requestInfo }) => {
  try {
    await enforceRateLimit("tracking", `ip:${requestInfo.ip}`);
    await recordEmailEvent(params.token, "open", { headers: request.headers });
  } catch (error) {
    if (error?.code !== "RATE_LIMITED") logger.warn("Email open not recorded", { code: error?.code });
  }
  return new Response(PIXEL_GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" } });
});
