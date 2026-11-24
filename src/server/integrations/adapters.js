import "server-only";
import { createHmac } from "node:crypto";
import { AppError } from "../errors.js";
import { outboundFetch } from "./net-guard.js";

/**
 * Channel adapters. Each `publish` receives decrypted secrets, the item content
 * ({ text, link, title }) and returns { externalUrl? }. Errors are AppErrors with
 * code INTEGRATION_FAILED and a user-safe message.
 */
const fail = (message, details) => new AppError("INTEGRATION_FAILED", message, 502, details);

async function readJson(res) {
  return res.json().catch(() => ({}));
}

export function signWebhook(secret, timestamp, body) {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export const ADAPTERS = {
  WEBHOOK: {
    async publish({ secret, config, payload }) {
      const body = JSON.stringify(payload);
      const ts = Math.floor(Date.now() / 1000).toString();
      const res = await outboundFetch(secret.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "BrandAI-Webhook/1.0", "X-BrandAI-Timestamp": ts, "X-BrandAI-Signature": signWebhook(secret.signingSecret, ts, body), "X-BrandAI-Event": payload.event },
        body,
      }, { guard: true });
      if (res.status >= 300) throw fail(`The webhook answered with HTTP ${res.status}.`);
      return { externalUrl: null, ref: config.host };
    },
    async test(args) {
      return ADAPTERS.WEBHOOK.publish({ ...args, payload: { event: "brandai.test", sentAt: new Date().toISOString(), message: "Brand AI connection test" } });
    },
  },

  TELEGRAM: {
    async publish({ secret, config, content }) {
      const text = [content.text, content.link].filter(Boolean).join("\n\n").slice(0, 4096);
      const res = await outboundFetch(`https://api.telegram.org/bot${secret.botToken}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: config.chatId, text }),
      });
      const data = await readJson(res);
      if (!res.ok || !data.ok) throw fail(`Telegram refused the message: ${String(data.description ?? res.status).slice(0, 200)}`);
      const id = data.result?.message_id;
      return { externalUrl: config.chatId.startsWith("@") && id ? `https://t.me/${config.chatId.slice(1)}/${id}` : null };
    },
    async test({ secret }) {
      const res = await outboundFetch(`https://api.telegram.org/bot${secret.botToken}/getMe`, { method: "GET" });
      const data = await readJson(res);
      if (!res.ok || !data.ok) throw fail("Telegram did not accept the bot token.");
      return { externalUrl: null, ref: data.result?.username };
    },
  },

  FACEBOOK_PAGE: {
    async publish({ secret, config, content }) {
      const form = new URLSearchParams({ message: content.text.slice(0, 63000), access_token: secret.accessToken });
      if (content.link) form.set("link", content.link);
      const res = await outboundFetch(`https://graph.facebook.com/v21.0/${config.pageId}/feed`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
      const data = await readJson(res);
      if (!res.ok || !data.id) throw fail(`Facebook refused the post: ${String(data.error?.message ?? res.status).slice(0, 200)}`);
      return { externalUrl: `https://www.facebook.com/${data.id}` };
    },
    async test({ secret, config }) {
      const res = await outboundFetch(`https://graph.facebook.com/v21.0/${config.pageId}?fields=name&access_token=${encodeURIComponent(secret.accessToken)}`, { method: "GET" });
      const data = await readJson(res);
      if (!res.ok || !data.name) throw fail("Facebook did not accept the page ID or token.");
      return { externalUrl: null, ref: data.name };
    },
  },
};
