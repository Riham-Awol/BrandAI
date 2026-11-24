import { existsSync } from "node:fs";
import { config } from "dotenv";

/**
 * Integration tests run against a dedicated MySQL database (TEST_DATABASE_URL).
 * Values come from the environment or from .env.test (never .env).
 */
export function loadTestEnv() {
  if (existsSync(".env.test")) config({ path: ".env.test", quiet: true });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set. Copy .env.test.example to .env.test.");
  const dbName = new URL(url).pathname.slice(1);
  if (!/_test$/.test(dbName)) throw new Error(`Refusing to run integration tests against "${dbName}": database name must end with _test.`);
  Object.assign(process.env, {
    NODE_ENV: "test",
    APP_ENV: "test",
    DATABASE_URL: url,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "test-secret-not-for-production-use-0000",
    AI_TEXT_PROVIDER: "mock",
    AI_ALLOW_MOCK: "true",
    STORAGE_PROVIDER: "memory",
    EMAIL_PROVIDER: "console",
    RATE_LIMIT_STORE: "database",
  });
  return url;
}
