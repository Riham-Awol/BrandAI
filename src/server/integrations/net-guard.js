import "server-only";
import { lookup } from "node:dns";
import { isIP } from "node:net";
import { Agent } from "undici";
import { AppError } from "../errors.js";

/**
 * SSRF protection for user-supplied URLs (webhooks). Only https on port 443,
 * no credentials in the URL, and every resolved address must be public — the
 * check runs in the connection's DNS lookup, so DNS rebinding can't bypass it.
 * Redirects are not followed.
 */
const V4_BLOCKS = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
];
const toInt = (ip) => ip.split(".").reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;

export function isPublicAddress(ip) {
  if (isIP(ip) === 4) {
    const n = toInt(ip);
    return !V4_BLOCKS.some(([base, bits]) => (n >>> (32 - bits)) === (toInt(base) >>> (32 - bits)));
  }
  if (isIP(ip) === 6) {
    const a = ip.toLowerCase();
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicAddress(mapped[1]);
    if (a === "::" || a === "::1") return false;
    return !/^(fc|fd|fe8|fe9|fea|feb|ff|2001:db8|64:ff9b)/.test(a.replace(/^0+/, ""));
  }
  return false;
}

/** Validates a webhook URL's shape (DNS is checked at connect time). */
export function assertSafeUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError("VALIDATION_ERROR", "Invalid URL.", 422, { url: ["Invalid URL."] });
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || (isIP(host) && !isPublicAddress(host)) || /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) {
    throw new AppError("VALIDATION_ERROR", "This URL is not allowed.", 422, { url: ["Use a public https:// URL (no IP ranges inside private networks, no custom ports)."] });
  }
  return url;
}

function guardedLookup(hostname, options, callback) {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: options.family }];
    const bad = list.find((a) => !isPublicAddress(a.address));
    if (bad) return callback(Object.assign(new Error(`Blocked non-public address for ${hostname}`), { code: "EBLOCKED" }));
    if (options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

const guardedAgent = new Agent({ connect: { lookup: guardedLookup, timeout: 10_000 } });

let fetchImpl = null;
/** Test hook: replaces outbound HTTP for integrations. */
export function setIntegrationFetch(fn) {
  fetchImpl = fn;
}

/**
 * Outbound request for integrations. `guard: true` applies the SSRF protection
 * (user-supplied hosts); fixed API hosts (Telegram, Facebook) use the normal client.
 */
export async function outboundFetch(url, init = {}, { guard = false, timeoutMs = 15_000 } = {}) {
  if (guard) assertSafeUrl(url);
  const opts = { ...init, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) };
  try {
    if (fetchImpl) return await fetchImpl(url, opts);
    return await fetch(url, guard ? { ...opts, dispatcher: guardedAgent } : opts);
  } catch (error) {
    const blocked = error?.cause?.code === "EBLOCKED" || error?.code === "EBLOCKED";
    throw new AppError("INTEGRATION_FAILED", blocked ? "The destination resolves to a private network address and was blocked." : error?.name === "TimeoutError" ? "The destination did not respond in time." : "Could not reach the destination.", 502);
  }
}
