import "server-only";
import { createPrismaClient } from "./create-client.js";

// One client per server process (avoids exhausting connections during
// Next.js hot reloads). Created lazily on first use so that importing a
// service module never requires DATABASE_URL (unit tests, builds).
const globalForPrisma = globalThis;

function getClient() {
  if (!globalForPrisma.__brandaiPrisma) globalForPrisma.__brandaiPrisma = createPrismaClient();
  return globalForPrisma.__brandaiPrisma;
}

export const prisma = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getClient();
      const value = client[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  },
);
