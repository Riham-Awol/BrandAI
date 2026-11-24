import { afterAll, beforeEach } from "vitest";
import { loadTestEnv } from "./load-test-env.js";

loadTestEnv();

const { prisma } = await import("@/server/db/prisma.js");
const { resetDatabase } = await import("./db.js");

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});
