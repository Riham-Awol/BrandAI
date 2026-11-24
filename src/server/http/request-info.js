/** Extracts client info for audit logs and rate limiting. */
export function getRequestInfo(request) {
  const headers = request?.headers;
  const forwarded = headers?.get?.("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0] : headers?.get?.("x-real-ip")) || "unknown";
  return { ip: ip.trim(), userAgent: headers?.get?.("user-agent") ?? null };
}
