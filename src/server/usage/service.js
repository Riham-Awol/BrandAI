import "server-only";
import { prisma } from "../db/prisma.js";
import { Errors } from "../errors.js";
import { requireWorkspaceAccess } from "../permissions/authorize.js";
import { PERMISSIONS } from "../permissions/roles.js";
import { periodStart } from "./period.js";

async function measure(workspaceId, metric, since) {
  if (metric === "STORAGE_BYTES") {
    const agg = await prisma.storedFile.aggregate({ where: { workspaceId, deletedAt: null }, _sum: { sizeBytes: true } });
    return BigInt(agg._sum.sizeBytes ?? 0);
  }
  if (metric === "AI_COST_MICRO_USD") {
    const agg = await prisma.aiUsageRecord.aggregate({ where: { workspaceId, createdAt: { gte: since } }, _sum: { costMicroUsd: true } });
    return BigInt(agg._sum.costMicroUsd ?? 0n);
  }
  const kind = metric === "AI_IMAGE_REQUESTS" ? "IMAGE" : "TEXT";
  const count = await prisma.aiUsageRecord.count({ where: { workspaceId, kind, createdAt: { gte: since } } });
  return BigInt(count);
}

/** Throws USAGE_LIMIT_REACHED if any of the given metrics is exhausted. */
export async function assertWithinLimits(workspaceId, metrics, { additional = {} } = {}) {
  const limits = await prisma.usageLimit.findMany({ where: { workspaceId, metric: { in: metrics } } });
  for (const limit of limits) {
    const used = await measure(workspaceId, limit.metric, periodStart(limit.period));
    const extra = BigInt(additional[limit.metric] ?? 0);
    // Counters: allowed while used < limit. Sized metrics (storage): used + extra must fit.
    const exceeded = extra > 0n ? used + extra > limit.limitValue : used >= limit.limitValue;
    if (exceeded) throw Errors.usageLimit();
  }
}

export async function getUsageSummary(user, workspaceId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.USAGE_READ);
  const limits = await prisma.usageLimit.findMany({ where: { workspaceId: scope.workspaceId }, orderBy: { metric: "asc" } });
  return Promise.all(
    limits.map(async (l) => {
      const since = periodStart(l.period);
      const used = await measure(scope.workspaceId, l.metric, since);
      return { metric: l.metric, period: l.period, periodStart: since.toISOString(), used: used.toString(), limit: l.limitValue.toString() };
    }),
  );
}
