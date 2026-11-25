import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "../config/env.js";
import { Errors } from "../errors.js";
import { logger } from "../logger.js";

/**
 * Minimal Stripe REST client (no SDK): form-encoded requests with an
 * idempotency key, and webhook signature verification. Tests replace the
 * transport with setStripeFetch.
 */
let fetchImpl = (...args) => fetch(...args);
export function setStripeFetch(fn) {
  fetchImpl = fn ?? ((...args) => fetch(...args));
}

export function stripeConfigured() {
  return Boolean(getEnv().STRIPE_SECRET_KEY);
}

/** Stripe's nested form encoding: { a: { b: 1 }, c: [{ d: 2 }] } → a[b]=1&c[0][d]=2. Pure. */
export function encodeForm(obj, prefix = "", out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) value.forEach((v, i) => (typeof v === "object" ? encodeForm(v, `${name}[${i}]`, out) : out.append(`${name}[${i}]`, String(v))));
    else if (typeof value === "object") encodeForm(value, name, out);
    else out.append(name, String(value));
  }
  return out;
}

export async function stripeRequest(method, path, params, { idempotencyKey } = {}) {
  const key = getEnv().STRIPE_SECRET_KEY;
  if (!key) throw Errors.notConfigured("Payments (Stripe)");
  const body = params && method !== "GET" ? encodeForm(params).toString() : undefined;
  const qs = params && method === "GET" ? `?${encodeForm(params)}` : "";
  let res;
  try {
    res = await fetchImpl(`https://api.stripe.com/v1${path}${qs}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": "2024-06-20",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw Errors.upstream("Couldn't reach the payment provider. Please try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.warn("Stripe request failed", { path, status: res.status, type: data?.error?.type, code: data?.error?.code });
    if (res.status === 401) throw Errors.notConfigured("Payments (Stripe key rejected)");
    throw Errors.upstream(data?.error?.type === "invalid_request_error" ? "The payment provider rejected the request. Check the Stripe price settings." : "The payment provider had a problem. Please try again.");
  }
  return data;
}

/**
 * Verifies a Stripe-Signature header ("t=…,v1=…") over the raw body, with a
 * 5-minute replay window. Pure apart from the clock. Returns the parsed event.
 */
export function verifyStripeSignature(rawBody, header, secret, { now = Date.now(), toleranceSec = 300 } = {}) {
  if (!secret) throw Errors.notConfigured("Stripe webhooks (STRIPE_WEBHOOK_SECRET)");
  const parts = Object.fromEntries(String(header ?? "").split(",").map((p) => p.split("=")).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v.trim()]));
  const signatures = String(header ?? "").split(",").map((p) => p.trim()).filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  const t = Number(parts.t);
  if (!t || !signatures.length) throw Errors.validation({ signature: ["Missing signature."] }, "Invalid signature.");
  if (Math.abs(now / 1000 - t) > toleranceSec) throw Errors.validation({ signature: ["Timestamp outside the tolerance window."] }, "Invalid signature.");
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex"));
  const ok = signatures.some((s) => {
    const given = Buffer.from(s);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!ok) throw Errors.validation({ signature: ["Signature mismatch."] }, "Invalid signature.");
  return JSON.parse(rawBody);
}

/** Test helper: a valid signature header for a payload. */
export function signStripePayload(rawBody, secret, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex")}`;
}
