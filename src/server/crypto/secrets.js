import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getEnv } from "../config/env.js";
import { Errors } from "../errors.js";

/**
 * AES-256-GCM encryption for integration credentials. The key comes from
 * INTEGRATIONS_ENCRYPTION_KEY (base64, 32 bytes); without it, channels that
 * need secrets cannot be connected (SERVICE_NOT_CONFIGURED).
 * Format: "v1:<iv b64>:<tag b64>:<ciphertext b64>".
 */
function key() {
  const raw = getEnv().INTEGRATIONS_ENCRYPTION_KEY;
  const buf = raw ? Buffer.from(raw, "base64") : null;
  if (!buf || buf.length !== 32) throw Errors.notConfigured("Integration credential encryption (INTEGRATIONS_ENCRYPTION_KEY)");
  return buf;
}

export function encryptionConfigured() {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${data.toString("base64")}`;
}

export function decryptSecret(payload) {
  const [v, iv, tag, data] = String(payload).split(":");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unknown secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8"));
}
