import { createHash } from "node:crypto";

/**
 * Upload safety: the file type is decided from the file's magic bytes, never
 * from the client-supplied name or MIME type. SVG and HTML are rejected
 * because they can carry scripts.
 */
export const ALLOWED_TYPES = {
  "image/png": { ext: "png", magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  "image/jpeg": { ext: "jpg", magic: [[0xff, 0xd8, 0xff]] },
  "image/gif": { ext: "gif", magic: [[0x47, 0x49, 0x46, 0x38]] },
  "image/webp": { ext: "webp", magic: [[0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50]] },
  "application/pdf": { ext: "pdf", magic: [[0x25, 0x50, 0x44, 0x46, 0x2d]] },
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function detectMimeType(buffer) {
  for (const [mime, { magic }] of Object.entries(ALLOWED_TYPES)) {
    if (magic.some((sig) => sig.every((byte, i) => byte === null || buffer[i] === byte))) return mime;
  }
  return null;
}

export function sanitizeFileName(name) {
  const cleaned = String(name ?? "file")
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120);
  return cleaned || "file";
}

/** Returns { ok, mimeType, ext, checksum } or { ok: false, reason }. */
export function validateUpload(buffer, { maxBytes = MAX_UPLOAD_BYTES, allowed = Object.keys(ALLOWED_TYPES) } = {}) {
  if (!buffer || buffer.length === 0) return { ok: false, reason: "The file is empty." };
  if (buffer.length > maxBytes) return { ok: false, reason: `The file exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit.` };
  const mimeType = detectMimeType(buffer);
  if (!mimeType || !allowed.includes(mimeType)) return { ok: false, reason: "This file type is not allowed." };
  return { ok: true, mimeType, ext: ALLOWED_TYPES[mimeType].ext, checksum: createHash("sha256").update(buffer).digest("hex") };
}
