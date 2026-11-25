import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238: HMAC-SHA1, 30 s steps, 6 digits),
 * compatible with Google Authenticator, 1Password, Authy, etc. Pure.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const STEP_SECONDS = 30;

export function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function currentStep(now = Date.now()) {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

export function totpAt(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = h[h.length - 1] & 15;
  const code = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

/**
 * Checks a code within ±1 step of clock drift. Returns the matched step (so the
 * caller can refuse reuse of the same or an older step) or null.
 */
export function verifyTotp(secret, code, { now = Date.now(), lastStep = null, window = 1 } = {}) {
  const given = String(code ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(given)) return null;
  const step = currentStep(now);
  for (let s = step - window; s <= step + window; s++) {
    if (lastStep != null && s <= lastStep) continue;
    const expected = totpAt(secret, s);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(given))) return s;
  }
  return null;
}

export function otpauthUri({ secret, account, issuer = "Brand AI" }) {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}

const hashCode = (c) => createHash("sha256").update(String(c).toLowerCase().replace(/[^a-z0-9]/g, "")).digest("hex");

/** Ten single-use recovery codes ("xxxx-xxxx"); store only the hashes. */
export function generateRecoveryCodes(count = 10) {
  const codes = Array.from({ length: count }, () => {
    const s = base32Encode(randomBytes(5)).toLowerCase().slice(0, 8);
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
  return { codes, hashes: codes.map(hashCode) };
}

/** Returns the remaining hashes when `code` matches one (consumed), or null. */
export function consumeRecoveryCode(hashes, code) {
  const h = hashCode(code);
  if (!Array.isArray(hashes) || !hashes.includes(h)) return null;
  return hashes.filter((x) => x !== h);
}
