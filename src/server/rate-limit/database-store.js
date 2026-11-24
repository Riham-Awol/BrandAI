/**
 * MySQL-backed fixed-window store, shared by all serverless instances.
 *
 * The upsert and the read run in one transaction: the upsert takes a row lock
 * held until commit, so each caller reads exactly its own increment and
 * concurrent requests cannot observe each other's counts.
 */
export function createDatabaseStore(prisma) {
  return {
    async hit(key, windowMs, now = Date.now()) {
      const resetAt = new Date(now + windowMs);
      const nowDate = new Date(now);
      return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO rate_limit_buckets (\`key\`, count, reset_at, updated_at)
          VALUES (${key}, 1, ${resetAt}, ${nowDate})
          ON DUPLICATE KEY UPDATE
            count = IF(reset_at <= ${nowDate}, 1, count + 1),
            reset_at = IF(reset_at <= ${nowDate}, ${resetAt}, reset_at),
            updated_at = ${nowDate}`;
        const row = await tx.rateLimitBucket.findUnique({ where: { key }, select: { count: true, resetAt: true } });
        return { count: row.count, resetAt: row.resetAt.getTime() };
      });
    },
    async reset(key) {
      await prisma.rateLimitBucket.deleteMany({ where: { key } });
    },
  };
}
