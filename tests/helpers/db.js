/** Empties every application table in the TEST database (guarded by load-test-env). */
const TABLES = [
  "ai_usage_records", "ai_generations", "business_context_versions", "stored_files", "businesses",
  "notifications", "audit_logs", "usage_limits", "workspace_members", "workspaces", "auth_tokens", "users", "rate_limit_buckets",
];

export async function resetDatabase(prisma) {
  const dbName = new URL(process.env.DATABASE_URL).pathname.slice(1);
  if (!dbName.endsWith("_test")) throw new Error("resetDatabase may only run against a *_test database");
  // One interactive transaction = one pooled connection, so the session-level
  // FOREIGN_KEY_CHECKS toggle applies to every statement below.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of TABLES) await tx.$executeRawUnsafe(`DELETE FROM \`${table}\``);
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
  });
}
