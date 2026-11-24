import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/prisma.js";

/**
 * Lease lock in MySQL: only one holder until it releases or the lease expires
 * (so a crashed run can't block the scheduler forever). Returns a release
 * function, or null when someone else holds the lock.
 */
export async function acquireLock(name, leaseMs = 5 * 60000) {
  const owner = randomUUID();
  const now = new Date();
  const until = new Date(now.getTime() + leaseMs);
  let acquired = false;
  try {
    await prisma.jobLock.create({ data: { name, owner, lockedUntil: until } });
    acquired = true;
  } catch {
    const { count } = await prisma.jobLock.updateMany({ where: { name, lockedUntil: { lt: now } }, data: { owner, lockedUntil: until } });
    acquired = count === 1;
  }
  if (!acquired) return null;
  return async () => {
    await prisma.jobLock.updateMany({ where: { name, owner }, data: { lockedUntil: new Date(0) } });
  };
}
