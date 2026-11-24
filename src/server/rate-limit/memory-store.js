/** In-process fixed-window store. Suitable for tests and single-instance dev only. */
export function createMemoryStore() {
  const buckets = new Map();
  return {
    async hit(key, windowMs, now = Date.now()) {
      const existing = buckets.get(key);
      if (!existing || existing.resetAt <= now) {
        const bucket = { count: 1, resetAt: now + windowMs };
        buckets.set(key, bucket);
        return { ...bucket };
      }
      existing.count += 1;
      return { ...existing };
    },
    async reset(key) {
      buckets.delete(key);
    },
  };
}
