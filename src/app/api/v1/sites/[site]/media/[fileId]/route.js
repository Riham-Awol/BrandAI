import { route } from "@/server/http/route-handler.js";
import { getPublicMedia } from "@/modules/website/service.js";

/** Images of a published site (only files its published version uses). */
export const GET = route({ auth: false, rateLimit: "siteMedia" }, async ({ params }) => {
  const media = await getPublicMedia(params.site, params.fileId);
  if (media.url) return Response.redirect(media.url, 302);
  return new Response(media.body, { headers: { "Content-Type": media.mime, "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
});
