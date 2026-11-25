import { route } from "@/server/http/route-handler.js";
import { enforceRateLimit } from "@/server/rate-limit/index.js";
import { logger } from "@/server/logger.js";
import { PIXEL_GIF } from "@/modules/analytics/tracking.js";
import { recordSiteView } from "@/modules/analytics/tracking-service.js";

const gif = () => new Response(PIXEL_GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" } });

/**
 * Page-view pixel of a published site: GET ?p=<page slug>&s=<source>.
 * Always answers with the same 1×1 GIF so failures are invisible to visitors.
 */
export const GET = route({ auth: false, rateLimit: false }, async ({ request, params, requestInfo }) => {
  const url = new URL(request.url);
  const pageSlug = (url.searchParams.get("p") ?? "").slice(0, 64);
  const source = url.searchParams.get("s");
  try {
    await enforceRateLimit("tracking", `ip:${requestInfo.ip}`);
    if (/^[a-z0-9-]{1,64}$/.test(pageSlug) && (!source || /^(utm:)?[a-z0-9][a-z0-9._-]{0,252}$/.test(source))) {
      await recordSiteView(params.site, { pageSlug, source, ip: requestInfo.ip, headers: request.headers });
    }
  } catch (error) {
    if (error?.code !== "RATE_LIMITED") logger.warn("Site view not recorded", { code: error?.code });
  }
  return gif();
});
