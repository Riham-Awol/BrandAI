/**
 * Minimal structured logger. Strips obvious secrets from metadata.
 * Swap for a hosted log drain (Vercel, Datadog, ...) at deployment time.
 */
const REDACT = /(password|secret|token|authorization|api[_-]?key|cookie)/i;

function sanitize(value, depth = 0) {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: process.env.NODE_ENV === "production" ? undefined : value.stack };
  }
  if (!value || typeof value !== "object" || depth > 4) return value;
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, REDACT.test(k) ? "[redacted]" : sanitize(v, depth + 1)]),
  );
}

function write(level, message, meta) {
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const entry = { level, message, time: new Date().toISOString(), ...(meta ? sanitize(meta) : {}) };
  const line = JSON.stringify(entry, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message, meta) => write("info", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  error: (message, meta) => write("error", message, meta),
};
export { sanitize as _sanitizeForTests };
