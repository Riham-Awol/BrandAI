import "server-only";
import { prisma } from "../db/prisma.js";
import { AppError, Errors } from "../errors.js";
import { getEnv } from "../config/env.js";
import { recordAudit } from "../audit/service.js";
import { generateText } from "../ai/orchestrator.js";
import { OPENAI_COMPATIBLE_PROVIDERS, TEXT_PROVIDER_PRESETS, parseFallbackProviders } from "../ai/providers/presets.js";
import { uuidSchema } from "@/validation/common.js";
import { applyPlanLimits, getCreditStatus } from "../billing/entitlements.js";
import { PLANS, planInEffect } from "../billing/plans.js";
import { stripeConfigured } from "../billing/stripe.js";
import { encryptionConfigured } from "../crypto/secrets.js";
import { getPlatformSettings } from "./settings.js";
import "./mock-fixtures.js";

const DAY = 86400_000;
const PRICE_CENTS = { FREE: 0, PRO: 1900, AGENCY: 7900 };

/**
 * Platform administration. Every function re-reads the caller from the
 * database: platform admin flag set, account active and (by default) two-factor
 * sign-in on. Platform admins are granted only with `npm run admin:grant`.
 */
export async function requirePlatformAdmin(user) {
  if (!user?.id) throw Errors.unauthenticated();
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, isPlatformAdmin: true, suspendedAt: true, deletedAt: true, mfaEnabledAt: true } });
  if (!u?.isPlatformAdmin || u.suspendedAt || u.deletedAt) throw Errors.notFound();
  if (getEnv().PLATFORM_ADMIN_REQUIRE_MFA !== "false" && !u.mfaEnabledAt) {
    throw new AppError("MFA_REQUIRED", "Turn on two-factor sign-in (Settings → Account & security) to use the admin area.", 403);
  }
  return u;
}

/** Headline numbers for the platform. */
export async function getPlatformOverview(user) {
  await requirePlatformAdmin(user);
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY);
  const [users, newUsers, activeUsers, workspaces, subs, gens, failed, cost, byProvider] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, createdAt: { gte: since30 } } }),
    prisma.user.count({ where: { deletedAt: null, lastLoginAt: { gte: since30 } } }),
    prisma.workspace.groupBy({ by: ["type"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.subscription.findMany({ where: { workspace: { deletedAt: null } }, select: { plan: true, status: true, source: true } }),
    prisma.aiGeneration.count({ where: { createdAt: { gte: since30 } } }),
    prisma.aiGeneration.count({ where: { createdAt: { gte: since30 }, status: "FAILED" } }),
    prisma.aiUsageRecord.aggregate({ where: { createdAt: { gte: since30 } }, _sum: { costMicroUsd: true } }),
    prisma.aiUsageRecord.groupBy({ by: ["provider", "model"], where: { createdAt: { gte: since30 } }, _count: { _all: true }, _sum: { costMicroUsd: true } }),
  ]);
  const paid = subs.filter((s) => planInEffect(s) !== "FREE");
  const plans = Object.fromEntries(Object.keys(PLANS).map((k) => [k, 0]));
  for (const s of paid) plans[planInEffect(s)]++;
  // Paying = Stripe subscriptions in effect; plans set by an admin aren't revenue.
  const mrrCents = paid.filter((s) => s.source === "STRIPE").reduce((sum, s) => sum + PRICE_CENTS[planInEffect(s)], 0);
  return {
    users: { total: users, new30d: newUsers, active30d: activeUsers },
    workspaces: Object.fromEntries(workspaces.map((w) => [w.type, w._count._all])),
    plans, mrrCents, pastDue: subs.filter((s) => s.status === "PAST_DUE").length,
    ai: {
      requests30d: gens, failed30d: failed, failureRate: gens ? failed / gens : null, costMicroUsd30d: String(cost._sum.costMicroUsd ?? 0n),
      byModel: byProvider.map((p) => ({ provider: p.provider, model: p.model, requests: p._count._all, costMicroUsd: String(p._sum.costMicroUsd ?? 0n) })).sort((a, b) => b.requests - a.requests).slice(0, 10),
    },
  };
}

export async function listUsers(user, { q, take = 50 } = {}) {
  await requirePlatformAdmin(user);
  const rows = await prisma.user.findMany({
    where: { deletedAt: null, ...(q ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] } : {}) },
    orderBy: { createdAt: "desc" }, take,
    select: { id: true, name: true, email: true, createdAt: true, lastLoginAt: true, emailVerifiedAt: true, mfaEnabledAt: true, suspendedAt: true, isPlatformAdmin: true, _count: { select: { memberships: true } } },
  });
  return rows.map((u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt, emailVerified: Boolean(u.emailVerifiedAt), mfaEnabled: Boolean(u.mfaEnabledAt), suspended: Boolean(u.suspendedAt), isPlatformAdmin: u.isPlatformAdmin, workspaces: u._count.memberships }));
}

/** Suspends or restores an account; suspension ends every session immediately. */
export async function setUserSuspended(user, userId, { suspended, reason }, request) {
  const admin = await requirePlatformAdmin(user);
  if (!uuidSchema.safeParse(userId).success) throw Errors.notFound();
  if (userId === admin.id) throw Errors.conflict("You can't suspend yourself.");
  const target = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true, isPlatformAdmin: true } });
  if (!target) throw Errors.notFound();
  if (target.isPlatformAdmin) throw Errors.conflict("Platform admins are managed from the command line.");
  await prisma.user.update({ where: { id: userId }, data: suspended ? { suspendedAt: new Date(), sessionVersion: { increment: 1 } } : { suspendedAt: null } });
  await recordAudit({ action: suspended ? "platform.user_suspended" : "platform.user_restored", actorId: admin.id, entityType: "user", entityId: userId, metadata: { reason }, request });
  return { suspended };
}

export async function listWorkspaces(user, { q, take = 50 } = {}) {
  await requirePlatformAdmin(user);
  const rows = await prisma.workspace.findMany({
    where: { deletedAt: null, ...(q ? { OR: [{ name: { contains: q } }, { owner: { email: { contains: q } } }, ...(uuidSchema.safeParse(q).success ? [{ id: q }] : [])] } : {}) },
    orderBy: { createdAt: "desc" }, take,
    select: { id: true, name: true, type: true, createdAt: true, suspendedAt: true, agencyWorkspaceId: true, owner: { select: { email: true } }, subscription: { select: { plan: true, status: true, source: true } }, _count: { select: { members: true, businesses: true } } },
  });
  return rows.map((w) => ({ id: w.id, name: w.name, type: w.type, createdAt: w.createdAt, suspended: Boolean(w.suspendedAt), isClient: Boolean(w.agencyWorkspaceId), owner: w.owner.email, plan: planInEffect(w.subscription), status: w.subscription?.status ?? null, source: w.subscription?.source ?? null, members: w._count.members, businesses: w._count.businesses }));
}

async function findWorkspace(workspaceId) {
  if (!uuidSchema.safeParse(workspaceId).success) throw Errors.notFound();
  const ws = await prisma.workspace.findFirst({ where: { id: workspaceId, deletedAt: null }, include: { subscription: true } });
  if (!ws) throw Errors.notFound();
  return ws;
}

/** Assigns a plan by hand (support, partners, refunds). Stripe-managed plans change in Stripe. */
export async function setWorkspacePlan(user, workspaceId, { plan, note }, request) {
  const admin = await requirePlatformAdmin(user);
  const ws = await findWorkspace(workspaceId);
  if (ws.agencyWorkspaceId) throw Errors.conflict("Client workspaces use their agency's plan.");
  const s = ws.subscription;
  if (s?.source === "STRIPE" && s.stripeSubscriptionId && ["ACTIVE", "TRIALING", "PAST_DUE"].includes(s.status)) {
    throw Errors.conflict("This workspace pays through Stripe. Change or cancel the subscription in the Stripe dashboard.");
  }
  await prisma.subscription.upsert({ where: { workspaceId: ws.id }, create: { workspaceId: ws.id, plan, status: "ACTIVE", source: "ADMIN" }, update: { plan, status: "ACTIVE", source: "ADMIN", stripeSubscriptionId: null, cancelAtPeriodEnd: false, currentPeriodEnd: null } });
  await applyPlanLimits(ws.id, plan);
  await recordAudit({ action: "platform.plan_set", actorId: admin.id, workspaceId: ws.id, entityType: "workspace", entityId: ws.id, metadata: { plan, note }, request });
  return { plan };
}

/** Adds (or, with a negative amount, removes) extra AI credits. */
export async function grantCredits(user, workspaceId, { amount, note }, request) {
  const admin = await requirePlatformAdmin(user);
  const ws = await findWorkspace(workspaceId);
  const accountId = ws.agencyWorkspaceId ?? ws.id;
  if (amount < 0) {
    const { extra } = await getCreditStatus(accountId);
    if (extra + amount < 0) throw Errors.validation({ amount: [`Only ${extra} extra credits to remove.`] });
  }
  await prisma.aiCreditEntry.create({ data: { workspaceId: accountId, amount, kind: "ADMIN_GRANT", note: note.slice(0, 300), createdById: admin.id } });
  await recordAudit({ action: "platform.credits_granted", actorId: admin.id, workspaceId: accountId, entityType: "workspace", entityId: accountId, metadata: { amount, note }, request });
  return getCreditStatus(accountId);
}

export async function setWorkspaceSuspended(user, workspaceId, { suspended, reason }, request) {
  const admin = await requirePlatformAdmin(user);
  const ws = await findWorkspace(workspaceId);
  await prisma.workspace.update({ where: { id: ws.id }, data: { suspendedAt: suspended ? new Date() : null } });
  await recordAudit({ action: suspended ? "platform.workspace_suspended" : "platform.workspace_restored", actorId: admin.id, workspaceId: ws.id, entityType: "workspace", entityId: ws.id, metadata: { reason }, request });
  return { suspended };
}

/** AI configuration (no secrets: only whether keys are present) and recent health per provider. */
export async function getAiAdministration(user) {
  await requirePlatformAdmin(user);
  const env = getEnv();
  const since = new Date(Date.now() - 7 * DAY);
  const providers = OPENAI_COMPATIBLE_PROVIDERS.map((key) => {
    const p = TEXT_PROVIDER_PRESETS[key];
    return { key, label: p.label, keyConfigured: p.requiresKey ? Boolean(env[p.keyEnv]) : true, defaultModel: p.defaultModel };
  });
  const [stats, settings] = await Promise.all([
    prisma.aiGeneration.groupBy({ by: ["provider", "status"], where: { createdAt: { gte: since } }, _count: { _all: true }, _avg: { latencyMs: true } }),
    getPlatformSettings(),
  ]);
  const health = {};
  for (const s of stats) {
    const h = (health[s.provider] ??= { provider: s.provider, succeeded: 0, failed: 0, avgLatencyMs: null });
    if (s.status === "SUCCEEDED") {
      h.succeeded += s._count._all;
      h.avgLatencyMs = Math.round(s._avg.latencyMs ?? 0);
    } else if (s.status === "FAILED") h.failed += s._count._all;
  }
  return {
    primary: env.AI_TEXT_PROVIDER, model: env.AI_TEXT_MODEL ?? null, fallbacks: parseFallbackProviders(env.AI_TEXT_FALLBACK_PROVIDERS, env.AI_TEXT_PROVIDER),
    mockAllowed: env.AI_ALLOW_MOCK === "true", providers, health: Object.values(health),
    paused: settings.aiPaused === true, pausedMessage: settings.aiPausedMessage ?? "",
    services: { payments: stripeConfigured() && Boolean(env.STRIPE_WEBHOOK_SECRET), email: env.EMAIL_PROVIDER, encryption: encryptionConfigured(), scheduler: Boolean(env.CRON_SECRET), storage: env.STORAGE_PROVIDER },
  };
}

/** Pauses/resumes all AI generation platform-wide (provider incident, cost spike). */
export async function setAiPaused(user, { paused, message }, request) {
  const admin = await requirePlatformAdmin(user);
  await prisma.$transaction([
    prisma.platformSetting.upsert({ where: { key: "aiPaused" }, create: { key: "aiPaused", value: paused, updatedById: admin.id }, update: { value: paused, updatedById: admin.id } }),
    prisma.platformSetting.upsert({ where: { key: "aiPausedMessage" }, create: { key: "aiPausedMessage", value: message ?? "", updatedById: admin.id }, update: { value: message ?? "", updatedById: admin.id } }),
  ]);
  await recordAudit({ action: paused ? "platform.ai_paused" : "platform.ai_resumed", actorId: admin.id, metadata: { message }, request });
  return { paused };
}

export async function setSignupsOpen(user, { open }, request) {
  const admin = await requirePlatformAdmin(user);
  await prisma.platformSetting.upsert({ where: { key: "signupsOpen" }, create: { key: "signupsOpen", value: open, updatedById: admin.id }, update: { value: open, updatedById: admin.id } });
  await recordAudit({ action: open ? "platform.signups_opened" : "platform.signups_closed", actorId: admin.id, request });
  return { open };
}

/** A tiny real request through the normal pipeline (counted against the admin's own workspace). */
export async function testAi(user, request) {
  await requirePlatformAdmin(user);
  const own = await prisma.workspace.findFirst({ where: { ownerId: user.id, type: "PERSONAL", deletedAt: null }, select: { id: true } });
  if (!own) throw Errors.conflict("No personal workspace to run the test in.");
  const started = Date.now();
  const r = await generateText({ user, workspaceId: own.id, module: "admin", task: "health", instructions: "Reply with the single word OK.", input: "Health check", maxTokens: 20, request });
  return { ok: true, provider: r.provider, model: r.model, ms: Date.now() - started, isMock: r.isMock, reply: String(typeof r.data === "string" ? r.data : (r.text ?? "")).slice(0, 40) };
}

/** Platform-wide audit trail. */
export async function listPlatformAudit(user, { action, actor, workspaceId, before, take = 100 } = {}) {
  await requirePlatformAdmin(user);
  const rows = await prisma.auditLog.findMany({
    where: {
      ...(action ? { action: { startsWith: action } } : {}),
      ...(workspaceId ? { workspaceId } : {}),
      ...(actor ? { actor: { email: { contains: actor } } } : {}),
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: "desc" }, take: take + 1,
    select: { id: true, action: true, workspaceId: true, entityType: true, entityId: true, metadata: true, ipAddress: true, createdAt: true, actor: { select: { email: true } } },
  });
  const page = rows.slice(0, take);
  return { entries: page.map((r) => ({ ...r, actor: r.actor?.email ?? "System" })), nextBefore: rows.length > take ? page.at(-1).createdAt.toISOString() : null };
}
