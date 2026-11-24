import { NextResponse } from "next/server";
import { route } from "@/server/http/route-handler.js";
import { unsubscribeByToken } from "@/modules/automation/contacts-service.js";

/**
 * Unsubscribe: RFC 8058 one-click POST from mail clients, or the confirmation
 * form on /u/:token (redirects back). Always succeeds visibly; unknown tokens
 * reveal nothing.
 */
export const POST = route({ auth: false, rateLimit: "api" }, async ({ request, params }) => {
  await unsubscribeByToken(params.token);
  if (new URL(request.url).searchParams.get("redirect") === "1") return NextResponse.redirect(new URL(`/u/${encodeURIComponent(params.token)}?done=1`, request.url), 303);
  return new Response(null, { status: 204 });
});
