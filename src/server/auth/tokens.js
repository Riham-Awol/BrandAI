import { createHash, randomBytes } from "node:crypto";

/** Generates a URL-safe random token and the hash we store for it. */
export function generateToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
