import "server-only";
import { prisma } from "../db/prisma.js";
import { getEnv } from "../config/env.js";
import { createDatabaseStore } from "./database-store.js";
import { createMemoryStore } from "./memory-store.js";
import { createRateLimiter, RATE_LIMITS } from "./limiter.js";

let limiter;

export function getRateLimiter() {
  if (!limiter) {
    const store = getEnv().RATE_LIMIT_STORE === "memory" ? createMemoryStore() : createDatabaseStore(prisma);
    limiter = createRateLimiter(store);
  }
  return limiter;
}

/** Enforces a named policy for an identifier (ip, user id, email hash...). */
export function enforceRateLimit(policyName, identifier) {
  const policy = RATE_LIMITS[policyName];
  if (!policy) throw new Error(`Unknown rate limit policy: ${policyName}`);
  return getRateLimiter().enforce(`${policyName}:${identifier}`, policy);
}

export { RATE_LIMITS };
