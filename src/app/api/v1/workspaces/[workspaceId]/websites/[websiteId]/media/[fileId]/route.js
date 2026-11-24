import { route } from "@/server/http/route-handler.js";
import { getPreviewMedia } from "@/modules/website/service.js";

/** Business image for the editor preview. */
export const GET = route({}, async ({ user, params }) => {
  const media = await getPreviewMedia(user, params.workspaceId, params.websiteId, params.fileId);
  if (media.url) return Response.redirect(media.url, 302);
  return new Response(media.body, { headers: { "Content-Type": media.mime, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
});
