import "server-only";
import { prisma } from "../db/prisma.js";
import { AppError } from "../errors.js";

/** Platform-wide switches (set by platform admins). Defaults apply when unset. */
export const PLATFORM_DEFAULTS = { aiPaused: false, aiPausedMessage: "", signupsOpen: true };

export async function getPlatformSettings(client = prisma) {
  const rows = await client.platformSetting.findMany();
  return { ...PLATFORM_DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
}

/** Refuses AI requests while a platform admin has paused AI (incident, provider outage, cost spike). */
export async function assertAiAvailable() {
  const row = await prisma.platformSetting.findUnique({ where: { key: "aiPaused" } });
  if (row?.value === true) {
    const msg = await prisma.platformSetting.findUnique({ where: { key: "aiPausedMessage" } });
    throw new AppError("AI_PAUSED", (typeof msg?.value === "string" && msg.value) || "AI features are paused for maintenance. Please try again later.", 503);
  }
}
