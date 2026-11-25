#!/usr/bin/env node
/**
 * Grants (or with --revoke removes) platform-admin rights. Run on the server:
 *   npm run admin:grant -- you@example.com
 *   npm run admin:grant -- you@example.com --revoke
 * Platform admins can see every workspace's metadata, so this is deliberately
 * not available in the web app.
 */
import "dotenv/config";
import { createPrismaClient } from "../src/server/db/create-client.js";

const [email, flag] = process.argv.slice(2);
if (!email || !email.includes("@")) {
  console.error("Usage: npm run admin:grant -- <email> [--revoke]");
  process.exit(1);
}
const prisma = createPrismaClient();
try {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.deletedAt) throw new Error(`No account for ${email}. Register first.`);
  const grant = flag !== "--revoke";
  await prisma.user.update({ where: { id: user.id }, data: { isPlatformAdmin: grant } });
  await prisma.auditLog.create({ data: { action: grant ? "platform.admin_granted" : "platform.admin_revoked", actorId: null, entityType: "user", entityId: user.id, metadata: { via: "cli" } } });
  console.log(`${grant ? "Granted" : "Revoked"} platform admin for ${user.email}.${grant ? " They must turn on two-factor sign-in to open /admin." : ""}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
