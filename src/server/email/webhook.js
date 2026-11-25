import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Errors } from "../errors.js";

/**
 * Verifies a Resend (Svix) webhook: HMAC-SHA256 over "id.timestamp.body" with
 * the base64 secret after "whsec_", 5-minute replay window. Pure apart from the clock.
 */
export function verifySvixSignature(rawBody, headers, secret, { now = Date.now(), toleranceSec = 300 } = {}) {
  if (!secret) throw Errors.notConfigured("Email webhooks (RESEND_WEBHOOK_SECRET)");
  const id = headers.get("svix-id");
  const ts = Number(headers.get("svix-timestamp"));
  const sigs = String(headers.get("svix-signature") ?? "").split(" ").map((s) => s.split(",")).filter(([v]) => v === "v1").map(([, s]) => s);
  if (!id || !ts || !sigs.length) throw Errors.validation({ signature: ["Missing signature."] }, "Invalid signature.");
  if (Math.abs(now / 1000 - ts) > toleranceSec) throw Errors.validation({ signature: ["Timestamp outside the tolerance window."] }, "Invalid signature.");
  const key = Buffer.from(String(secret).replace(/^whsec_/, ""), "base64");
  const expected = Buffer.from(createHmac("sha256", key).update(`${id}.${ts}.${rawBody}`).digest("base64"));
  const ok = sigs.some((s) => {
    const given = Buffer.from(s);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!ok) throw Errors.validation({ signature: ["Signature mismatch."] }, "Invalid signature.");
  return JSON.parse(rawBody);
}

/** Test helper: headers for a signed payload. */
export function signSvixPayload(rawBody, secret, { id = "msg_test", ts = Math.floor(Date.now() / 1000) } = {}) {
  const key = Buffer.from(String(secret).replace(/^whsec_/, ""), "base64");
  const sig = createHmac("sha256", key).update(`${id}.${ts}.${rawBody}`).digest("base64");
  return new Headers({ "svix-id": id, "svix-timestamp": String(ts), "svix-signature": `v1,${sig}` });
}
