import { route } from "@/server/http/route-handler.js";
import { previewCampaign } from "@/modules/automation/campaigns-service.js";

/** The email as HTML (sandboxed: no scripts, shown in an iframe preview). */
export const GET = route({}, async ({ user, params }) => {
  const html = await previewCampaign(user, params.workspaceId, params.campaignId);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; sandbox; frame-ancestors 'self'", "X-Frame-Options": "SAMEORIGIN", "Cache-Control": "private, no-store" } });
});
