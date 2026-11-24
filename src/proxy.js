import { NextResponse } from "next/server";

/**
 * 1. Custom domains (Phase 6): a request for a host that is not the app's own
 *    host is rewritten to the public site route /sites/:host/:path. The site is
 *    served only if that domain is VERIFIED for a published website.
 * 2. Optimistic route protection only: redirects visitors without a session
 *    cookie away from the app. Real authentication and authorization happen in
 *    the Data Access Layer (src/server/auth/session.js) on every request.
 */
const SESSION_COOKIES = ["__Secure-next-auth.session-token", "next-auth.session-token"];
const PROTECTED = [/^\/dashboard(\/|$)/, /^\/launch(\/|$)/, /^\/businesses(\/|$)/, /^\/brand(\/|$)/, /^\/strategy(\/|$)/, /^\/social(\/|$)/, /^\/design(\/|$)/, /^\/websites(\/|$)/, /^\/settings(\/|$)/, /^\/stationery(\/|$)/, /^\/print(\/|$)/];
const PASS_THROUGH = /^\/(api|_next|sites)(\/|$)|^\/favicon\.ico$/;

function appHosts() {
  const hosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  for (const v of [process.env.APP_URL, process.env.NEXTAUTH_URL]) {
    try {
      if (v) hosts.add(new URL(v).hostname.toLowerCase());
    } catch {
      // ignore malformed values; env validation reports them elsewhere
    }
  }
  return hosts;
}

export function siteHostFor(request) {
  const raw = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const host = raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
  if (!host || appHosts().has(host) || !/^(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(host)) return null;
  return host;
}

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const siteHost = siteHostFor(request);
  if (siteHost && !PASS_THROUGH.test(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/sites/${siteHost}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }
  if (!PROTECTED.some((re) => re.test(pathname))) return NextResponse.next();
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?callbackUrl=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
