import "server-only";
import { prisma } from "../db/prisma.js";
import { Errors } from "../errors.js";
import { periodStart } from "../usage/period.js";
import { PLANS, RESOURCE_LABELS, limitFor, planInEffect, withinLimit } from "./plans.js";

/**
 * What a workspace is entitled to. A client workspace of an agency uses the
 * agency's plan, and its AI use draws on the agency's credits ("credit account").
 */
export async function getEntitlements(workspaceId, client = prisma) {
  const ws = await client.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, agencyWorkspaceId: true, type: true } });
  const accountId = ws?.agencyWorkspaceId ?? workspaceId;
  const sub = await client.subscription.findUnique({ where: { workspaceId: accountId } });
  const plan = planInEffect(sub);
  return { workspaceId, accountId, isClient: Boolean(ws?.agencyWorkspaceId), plan, status: sub?.status ?? "ACTIVE", limits: PLANS[plan].limits };
}

async function countResource(workspaceId, resource, client) {
  switch (resource) {
    case "members": {
      const [members, invites] = await Promise.all([
        client.workspaceMember.count({ where: { workspaceId } }),
        client.workspaceInvitation.count({ where: { workspaceId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } }),
      ]);
      return members + invites;
    }
    case "businesses":
      return client.business.count({ where: { workspaceId, deletedAt: null } });
    case "websites":
      return client.website.count({ where: { workspaceId, deletedAt: null } });
    case "clients":
      return client.agencyClient.count({ where: { agencyWorkspaceId: workspaceId, status: { not: "ARCHIVED" } } });
    default:
      throw new Error(`Unknown resource ${resource}`);
  }
}

/** Throws PLAN_LIMIT_REACHED when adding more of `resource` would exceed the plan. */
export async function assertPlanAllows(workspaceId, resource, { adding = 1, client = prisma } = {}) {
  const ent = await getEntitlements(workspaceId, client);
  const current = await countResource(workspaceId, resource, client);
  if (!withinLimit(ent.plan, resource, current, adding)) {
    const limit = limitFor(ent.plan, resource);
    throw Errors.planLimit(
      limit === 0
        ? `The ${PLANS[ent.plan].name} plan doesn't include ${RESOURCE_LABELS[resource]}. Upgrade in Settings → Plan & usage.`
        : `The ${PLANS[ent.plan].name} plan includes up to ${limit} ${RESOURCE_LABELS[resource]}${ent.isClient ? " per client workspace" : ""}. Upgrade in Settings → Plan & usage.`,
    );
  }
  return ent;
}

/** Writes the plan's caps into usage_limits (storage, AI cost safety cap, monthly AI credits). */
export async function applyPlanLimits(workspaceId, planKey, client = prisma) {
  const l = PLANS[planKey].limits;
  const rows = [
    ["STORAGE_BYTES", BigInt(l.storageBytes)],
    ["AI_TEXT_REQUESTS", BigInt(l.aiCredits)],
    ["AI_COST_MICRO_USD", BigInt(l.aiCostCapMicroUsd)],
  ];
  for (const [metric, limitValue] of rows) {
    await client.usageLimit.upsert({
      where: { workspaceId_metric_period: { workspaceId, metric, period: "MONTHLY" } },
      create: { workspaceId, metric, period: "MONTHLY", limitValue },
      update: { limitValue },
    });
  }
}

/** Workspaces whose AI use counts against an account (the account and its agency clients). */
async function creditWorkspaceIds(accountId, client) {
  const clients = await client.workspace.findMany({ where: { agencyWorkspaceId: accountId }, select: { id: true } });
  return [accountId, ...clients.map((c) => c.id)];
}

/** Monthly allowance, used and extra (top-up) balance for a credit account. */
export async function getCreditStatus(workspaceId, client = prisma) {
  const ent = await getEntitlements(workspaceId, client);
  const ids = await creditWorkspaceIds(ent.accountId, client);
  const since = periodStart("MONTHLY");
  const [used, limitRow, balance] = await Promise.all([
    client.aiUsageRecord.count({ where: { workspaceId: { in: ids }, kind: "TEXT", createdAt: { gte: since } } }),
    client.usageLimit.findUnique({ where: { workspaceId_metric_period: { workspaceId: ent.accountId, metric: "AI_TEXT_REQUESTS", period: "MONTHLY" } } }),
    client.aiCreditEntry.aggregate({ where: { workspaceId: ent.accountId }, _sum: { amount: true } }),
  ]);
  const allowance = Number(limitRow?.limitValue ?? PLANS[ent.plan].limits.aiCredits);
  return { accountId: ent.accountId, plan: ent.plan, allowance, used, extra: balance._sum.amount ?? 0, periodStart: since.toISOString() };
}

/**
 * Before an AI request: allowed while the monthly allowance lasts, then while
 * extra credits remain. Returns whether this request will use an extra credit.
 */
export async function checkAiCredits(workspaceId) {
  const s = await getCreditStatus(workspaceId);
  if (s.used < s.allowance) return { useExtra: false, accountId: s.accountId };
  if (s.extra > 0) return { useExtra: true, accountId: s.accountId };
  throw Errors.usageLimit("You've used this month's AI credits. Buy extra credits or upgrade your plan in Settings → Plan & usage.");
}

/** After a successful AI request beyond the allowance: one extra credit is used. */
export async function spendExtraCredit(accountId, generationId) {
  await prisma.aiCreditEntry.create({ data: { workspaceId: accountId, amount: -1, kind: "USAGE", reference: generationId } }).catch((error) => {
    if (error?.code !== "P2002") throw error;
  });
}
