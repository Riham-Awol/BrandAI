import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";

/** Appends to the automation history (what happened, and why something was blocked or skipped). */
export function logRun(workspaceId, { kind, outcome, message, ruleId, itemId, actorId, details }) {
  return prisma.automationRun.create({ data: { workspaceId, kind, outcome, message: String(message).slice(0, 500), ruleId: ruleId ?? null, itemId: itemId ?? null, actorId: actorId ?? null, details: details ?? undefined } });
}

export async function listHistory(user, workspaceId, { outcome, kind, take = 100 } = {}) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  return prisma.automationRun.findMany({
    where: { workspaceId: scope.workspaceId, ...(outcome ? { outcome } : {}), ...(kind ? { kind } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(Number(take) || 100, 300),
  });
}
