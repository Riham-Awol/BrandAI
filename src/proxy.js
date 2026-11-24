import { NextResponse } from "next/server";

/**
 * Optimistic route protection only: redirects visitors without a session
 * cookie away from the app. Real authentication and authorization happen in
 * the Data Access Layer (src/server/auth/session.js) on every request.
 */
const SESSION_COOKIES = ["__Secure-next-auth.session-token", "next-auth.session-token"];

export function proxy(request) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?callbackUrl=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/launch/:path*", "/launch", "/businesses/:path*", "/brand", "/brand/:path*", "/strategy", "/strategy/:path*", "/settings/:path*"],
};
