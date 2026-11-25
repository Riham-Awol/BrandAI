import "server-only";
import { getEnv } from "../config/env.js";
import { Errors } from "../errors.js";
import { logger } from "../logger.js";

/**
 * Email abstraction. Providers:
 *  - console: development/test only; prints the message to the server log.
 *  - resend:  Resend HTTP API (requires RESEND_API_KEY).
 *  - none:    sending is disabled; callers get SERVICE_NOT_CONFIGURED.
 */
const providers = {
  async console({ to, subject, text }) {
    logger.info("[email:console] Email not sent — development console provider", { to, subject, text });
    return { id: "console" };
  },
  async resend({ to, subject, text, html, headers }, env) {
    if (!env.RESEND_API_KEY) throw Errors.notConfigured("Email (Resend)");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text, html, ...(headers ? { headers } : {}) }),
    });
    if (!res.ok) throw Errors.upstream("Email delivery failed.");
    return res.json();
  },
  async none() {
    throw Errors.notConfigured("Email");
  },
};

let transportOverride = null;

/** Tests only: capture outgoing messages instead of using the configured provider. */
export function setEmailTransport(fn) {
  transportOverride = fn;
}

export async function sendEmail(message) {
  if (transportOverride) return transportOverride(message);
  const env = getEnv();
  return providers[env.EMAIL_PROVIDER](message, env);
}

/** Which provider sends mail, and whether it really delivers (console only logs). */
export function emailProviderName() {
  return getEnv().EMAIL_PROVIDER;
}
