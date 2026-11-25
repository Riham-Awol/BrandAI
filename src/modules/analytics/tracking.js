import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Privacy-friendly tracking helpers. Pure (the secret is passed in).
 * - No cookies, no IP storage: a visitor is a daily-rotating HMAC of
 *   (day, site, IP, user agent), so the same person can't be followed across
 *   days or sites.
 * - Email tokens are HMAC-signed delivery ids, so a click redirect only ever
 *   goes to the campaign's stored link (never an open redirect).
 */

const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests|httpclient|axios|node-fetch|go-http|java\/|okhttp|scrapy|phantom|puppeteer|playwright/i;

/** True for empty or automated user agents (crawlers, link previews, headless browsers, HTTP libraries). */
export function isBot(userAgent) {
  const ua = String(userAgent ?? "").trim();
  if (ua.length < 10) return true;
  return BOT_RE.test(ua);
}

/** "mobile" | "tablet" | "desktop" from a user agent string. */
export function deviceFrom(userAgent) {
  const ua = String(userAgent ?? "");
  if (/ipad|tablet|kindle|silk|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua)) return "mobile";
  return "desktop";
}

const HOST_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const SOURCE_RE = /^[a-z0-9][a-z0-9._-]{0,59}$/;

/**
 * Where a visit came from: a `utm_source` value (sanitised, prefixed "utm:")
 * wins, otherwise the referring host; same-site and invalid values give null.
 */
export function referrerSource({ referer, ownHost, utmSource } = {}) {
  const utm = String(utmSource ?? "").trim().toLowerCase();
  if (utm && SOURCE_RE.test(utm)) return `utm:${utm}`;
  if (!referer) return null;
  let host;
  try {
    const u = new URL(referer);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    host = u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  const own = String(ownHost ?? "").toLowerCase().split(":")[0].replace(/^www\./, "");
  if (!HOST_RE.test(host) || host === own) return null;
  return host;
}

/** Calendar day (UTC) as a Date at midnight, for the `day` column. */
export function utcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function visitorHash({ secret, day, siteId, ip, userAgent }) {
  return createHmac("sha256", `${secret}:visitor`).update(`${day.toISOString().slice(0, 10)}|${siteId}|${ip ?? ""}|${userAgent ?? ""}`).digest("hex");
}

/** True when the browser asks not to be tracked (Global Privacy Control or Do Not Track). */
export function optedOut(headers) {
  return headers.get("sec-gpc") === "1" || headers.get("dnt") === "1";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function sig(secret, id) {
  return createHmac("sha256", `${secret}:email-track`).update(id).digest("base64url").slice(0, 22);
}

/** Signed token for one email delivery: "<uuid>.<sig>". */
export function signDeliveryToken(secret, deliveryId) {
  return `${deliveryId}.${sig(secret, deliveryId)}`;
}

/** Delivery id from a token, or null when malformed or forged. */
export function verifyDeliveryToken(secret, token) {
  const [id, given] = String(token ?? "").split(".");
  if (!UUID_RE.test(id ?? "") || !given) return null;
  const a = Buffer.from(given);
  const b = Buffer.from(sig(secret, id));
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

/** 1×1 transparent GIF. */
export const PIXEL_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
