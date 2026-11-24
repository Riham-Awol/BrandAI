import "server-only";
import { createPrismaClient } from "./create-client.js";

// Reuse one client per server process (avoids exhausting connections during
// Next.js hot reloads in development).
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.__brandaiPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__brandaiPrisma = prisma;
}
