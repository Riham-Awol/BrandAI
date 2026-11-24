import { execSync } from "node:child_process";
import { loadTestEnv } from "./load-test-env.js";

/** Applies all migrations to the test database once per run. */
export default function setup() {
  const url = loadTestEnv();
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url } });
}
