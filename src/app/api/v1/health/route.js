import { connection } from "next/server";
import { prisma } from "@/server/db/prisma.js";
import { ok, fail } from "@/server/http/api-response.js";

/** Liveness + database readiness. Exposes no configuration details. */
export async function GET() {
  await connection();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return ok({ status: "ok", database: "ok", time: new Date().toISOString() });
  } catch {
    return fail("UNHEALTHY", "Database unavailable.", 503);
  }
}
