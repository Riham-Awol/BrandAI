import { Errors } from "../errors.js";

/**
 * Pure limiter logic over a pluggable store (memory, database, later Redis).
 */
export function createRateLimiter(store) {
  return {
    async check(key, { limit, windowMs }) {
      const now = Date.now();
      const { count, resetAt } = await store.hit(key, windowMs, now);
      const remaining = Math.max(0, limit - count);
      return { allowed: count <= limit, remaining, resetAt, retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)) };
    },
    async enforce(key, options) {
      const result = await this.check(key, options);
      if (!result.allowed) throw Errors.rateLimited(result.retryAfterSeconds);
      return result;
    },
    reset: (key) => store.reset(key),
  };
}

/** Named policies so limits are defined in one place. */
export const RATE_LIMITS = {
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  passwordForgot: { limit: 5, windowMs: 60 * 60 * 1000 },
  passwordReset: { limit: 10, windowMs: 60 * 60 * 1000 },
  api: { limit: 120, windowMs: 60 * 1000 },
  aiGenerate: { limit: 20, windowMs: 60 * 1000 },
  // Public website forms: per visitor IP.
  siteForm: { limit: 5, windowMs: 10 * 60 * 1000 },
  siteMedia: { limit: 300, windowMs: 60 * 1000 },
  // Phase 9: page-view pixel and email open/click tracking, per visitor IP.
  tracking: { limit: 120, windowMs: 60 * 1000 },
  // Phase 10
  emailVerify: { limit: 3, windowMs: 60 * 60 * 1000 },
  invite: { limit: 30, windowMs: 60 * 60 * 1000 },
  billing: { limit: 20, windowMs: 10 * 60 * 1000 },
};
