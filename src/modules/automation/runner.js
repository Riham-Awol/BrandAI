import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { AppError, Errors, isAppError } from "@/server/errors.js";
import { recordAudit } from "@/server/audit/service.js";
import { notify } from "@/server/notifications/service.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { logger } from "@/server/logger.js";
import { ADAPTERS } from "@/server/integrations/adapters.js";
import { uuidSchema } from "@/validation/common.js";
import { acquireLock } from "@/server/jobs/lock.js";
import { isOverdue } from "@/modules/stationery/documents.js";
import { decidePublish, nextRetry, zonedDateTime } from "./policy.js";
import { loadSettings } from "./settings-service.js";
import { loadIntegrationForUse } from "./integrations-service.js";
import { emailsSentLast24h, sendCampaignBatch } from "./campaigns-service.js";
import { scheduleItem } from "./queue-service.js";
import { logRun } from "./history.js";

/**
 * The scheduler. Called by POST /api/v1/cron/run (any external scheduler) or
 * "Run now". Every outward action passes `decidePublish` with the workspace's
 * current mode and limits, and is written to the automation history.
 */
const STALE_LOCK_MS = 15 * 60000;

async function approverIds(workspaceId) {
  return (await prisma.workspaceMember.findMany({ where: { workspaceId, role: { in: ["OWNER", "ADMIN"] } }, select: { userId: true } })).map((m) => m.userId);
}

function payloadFor(item, businessName) {
  return { event: "brandai.publish", sentAt: new Date().toISOString(), business: { name: businessName }, item: { id: item.id, title: item.title, text: item.content.text, link: item.content.link ?? null, platform: item.content.platform ?? null, scheduledAt: item.scheduledAt } };
}

/** Executes one claimed item (status PUBLISHING). `authorizedBy` = a person pressing "Publish now". */
async function execute(item, { now, authorizedBy = null }) {
  const settings = await loadSettings(item.workspaceId);
  const integration = item.integrationId ? await loadIntegrationForUse(item.workspaceId, item.integrationId) : null;
  const publishedLast24h = await prisma.scheduledItem.count({ where: { workspaceId: item.workspaceId, status: "PUBLISHED", integrationId: { not: null }, publishedAt: { gte: new Date(now.getTime() - 86400000) } } });
  const emailsLeftToday = settings.dailyEmailLimit - (await emailsSentLast24h(item.workspaceId, now));
  const decision = authorizedBy
    ? decidePublish({ mode: "AUTOMATED", item: { ...item, approvedById: authorizedBy }, integration, publishedLast24h, dailyPublishLimit: settings.dailyPublishLimit, emailsLeftToday })
    : decidePublish({ mode: settings.mode, item, integration, publishedLast24h, dailyPublishLimit: settings.dailyPublishLimit, emailsLeftToday });
  const log = (outcome, message, details) => logRun(item.workspaceId, { kind: item.sourceType === "EMAIL_CAMPAIGN" ? "email" : "publish", outcome, message, itemId: item.id, actorId: authorizedBy, details });

  if (decision.action === "manual") {
    await prisma.scheduledItem.update({ where: { id: item.id }, data: { status: "MANUAL_DUE", lockedAt: null } });
    await notify({ userId: item.requestedById, workspaceId: item.workspaceId, type: "automation.manual_due", title: `Time to post: ${item.title}`, body: decision.reason, link: "/automation/queue" });
    await log("SKIPPED", `“${item.title}” is due — ${decision.reason} A reminder was sent.`);
    return "manual";
  }
  if (decision.action === "needs_approval") {
    await prisma.scheduledItem.update({ where: { id: item.id }, data: { status: "PENDING_APPROVAL", lockedAt: null } });
    await log("BLOCKED", `“${item.title}” was not published: ${decision.reason}`);
    return "blocked";
  }
  if (decision.action === "postpone") {
    if (authorizedBy) {
      await prisma.scheduledItem.update({ where: { id: item.id }, data: { status: "APPROVED", lockedAt: null } });
      throw new AppError("LIMIT_EXCEEDED", decision.reason, 429);
    }
    await prisma.scheduledItem.update({ where: { id: item.id }, data: { status: "APPROVED", lockedAt: null, scheduledAt: new Date(now.getTime() + 60 * 60000) } });
    await log("BLOCKED", `“${item.title}” postponed by 1 hour: ${decision.reason}`);
    return "postponed";
  }
  if (decision.action === "fail") {
    await prisma.scheduledItem.update({ where: { id: item.id }, data: { status: "FAILED", lockedAt: null, lastError: decision.reason } });
    await notify({ userId: item.requestedById, workspaceId: item.workspaceId, type: "automation.failed", title: `Not published: ${item.title}`, body: decision.reason, link: "/automation/queue" });
    await log("FAILED", `“${item.title}” failed: ${decision.reason}`);
    return "failed";
  }

  if (decision.action === "send_email") {
    const result = await sendCampaignBatch(item.workspaceId, item.content.campaignId, { now, actorId: authorizedBy });
    await prisma.scheduledItem.update({ where: { id: item.id }, data: result.done ? { status: "PUBLISHED", publishedAt: now, lockedAt: null } : { status: "APPROVED", lockedAt: null, scheduledAt: new Date(now.getTime() + 86400000) } });
    return result.done ? "published" : "postponed";
  }

  const business = await prisma.business.findUnique({ where: { id: item.businessId }, select: { name: true } });
  try {
    const result = await ADAPTERS[integration.type].publish({ secret: integration.secret, config: integration.config, content: item.content, payload: payloadFor(item, business?.name ?? "") });
    await prisma.$transaction([
      prisma.scheduledItem.update({ where: { id: item.id }, data: { status: "PUBLISHED", publishedAt: now, externalUrl: result.externalUrl ?? null, lockedAt: null, attempts: item.attempts + 1, lastError: null } }),
      prisma.integration.update({ where: { id: integration.id }, data: { lastUsedAt: now, status: "ACTIVE", lastError: null } }),
    ]);
    await log("SUCCESS", `“${item.title}” published to ${integration.name}${authorizedBy ? " (published now by a person)" : ""}.`, { externalUrl: result.externalUrl ?? null });
    return "published";
  } catch (error) {
    const message = isAppError(error) ? error.message : "Unexpected error while publishing.";
    if (!isAppError(error)) logger.error("Publish failed", { itemId: item.id, error: String(error) });
    const attempts = item.attempts + 1;
    const retryAt = authorizedBy ? null : nextRetry(attempts, now);
    await prisma.scheduledItem.update({ where: { id: item.id }, data: retryAt ? { status: "APPROVED", scheduledAt: retryAt, attempts, lastError: message, lockedAt: null } : { status: "FAILED", attempts, lastError: message, lockedAt: null } });
    await prisma.integration.update({ where: { id: integration.id }, data: { lastError: message.slice(0, 500) } });
    if (!retryAt) await notify({ userId: item.requestedById, workspaceId: item.workspaceId, type: "automation.failed", title: `Publishing failed: ${item.title}`, body: message, link: "/automation/queue" });
    await log("FAILED", `“${item.title}” failed (attempt ${attempts}): ${message}${retryAt ? " Retrying automatically." : ""}`);
    return "failed";
  }
}

/** Atomically claims an item so two runners never publish it twice. */
async function claim(id, from, now) {
  const { count } = await prisma.scheduledItem.updateMany({ where: { id, status: { in: from }, deletedAt: null }, data: { status: "PUBLISHING", lockedAt: now } });
  return count === 1;
}

// ── Rules ───────────────────────────────────────────────────────────────────

const RULE_HANDLERS = {
  async queue_ready_posts(rule, { now, settings }) {
    const creator = await prisma.user.findUnique({ where: { id: rule.createdById } });
    const today = now.toISOString().slice(0, 10);
    const posts = await prisma.socialPost.findMany({ where: { workspaceId: rule.workspaceId, status: "READY", deletedAt: null, scheduledDate: { gte: new Date(`${today}T00:00:00Z`) } }, take: 50 });
    let queued = 0;
    for (const post of posts) {
      const exists = await prisma.scheduledItem.findFirst({ where: { sourceType: "SOCIAL_POST", sourceId: post.id, deletedAt: null, status: { notIn: ["CANCELLED"] } }, select: { id: true } });
      if (exists) continue;
      const at = zonedDateTime(post.scheduledDate.toISOString().slice(0, 10), rule.params.time ?? "09:00", settings.timezone);
      if (at <= now) continue;
      await scheduleItem(creator, rule.workspaceId, { businessId: post.businessId, sourceType: "SOCIAL_POST", sourceId: post.id, integrationId: rule.params.integrationId ?? null, scheduledAt: at.toISOString(), submit: true }, undefined, { viaRule: rule.id });
      queued++;
    }
    return queued ? `Queued ${queued} ready post${queued === 1 ? "" : "s"}.` : null;
  },

  async approval_nudge(rule, { now }) {
    if (rule.lastRunAt && now - rule.lastRunAt < 6 * 3600000) return null;
    const pending = await prisma.scheduledItem.findMany({ where: { workspaceId: rule.workspaceId, status: "PENDING_APPROVAL", deletedAt: null, scheduledAt: { lte: new Date(now.getTime() + 86400000) } }, select: { title: true } });
    if (!pending.length) return null;
    for (const userId of await approverIds(rule.workspaceId)) {
      await notify({ userId, workspaceId: rule.workspaceId, type: "automation.approval_nudge", title: `${pending.length} item${pending.length === 1 ? "" : "s"} waiting for your approval`, body: pending.slice(0, 3).map((p) => p.title).join(" · "), link: "/automation/queue" });
    }
    return `Reminded approvers about ${pending.length} pending item${pending.length === 1 ? "" : "s"}.`;
  },

  async invoice_overdue(rule, { now }) {
    if (rule.lastRunAt && now - rule.lastRunAt < 20 * 3600000) return null;
    const today = now.toISOString().slice(0, 10);
    const docs = await prisma.businessDocument.findMany({ where: { workspaceId: rule.workspaceId, type: "INVOICE", status: "SENT", deletedAt: null, dueDate: { lt: new Date(`${today}T00:00:00Z`) } }, select: { id: true, number: true, createdById: true, type: true, status: true, dueDate: true } });
    const overdue = docs.filter((d) => isOverdue({ ...d, dueDate: d.dueDate.toISOString().slice(0, 10) }, today));
    for (const d of overdue) await notify({ userId: d.createdById, workspaceId: rule.workspaceId, type: "automation.invoice_overdue", title: `Invoice ${d.number} is overdue`, body: `Due ${d.dueDate.toISOString().slice(0, 10)}`, link: `/stationery/documents/${d.id}` });
    return overdue.length ? `${overdue.length} overdue invoice reminder${overdue.length === 1 ? "" : "s"} sent.` : null;
  },

  async forward_website_messages(rule, { now, settings }) {
    const since = rule.lastRunAt ?? rule.createdAt;
    const messages = await prisma.websiteSubmission.findMany({ where: { workspaceId: rule.workspaceId, createdAt: { gt: since, lte: now } }, orderBy: { createdAt: "asc" }, take: 50, include: { website: { select: { name: true } } } });
    if (!messages.length) return null;
    if (settings.mode !== "AUTOMATED") {
      await logRun(rule.workspaceId, { kind: "rule", outcome: "BLOCKED", message: `“${rule.name}”: ${messages.length} message(s) not forwarded — forwarding to an external system needs Authorized automation mode.`, ruleId: rule.id });
      return undefined;
    }
    const integration = await loadIntegrationForUse(rule.workspaceId, rule.params.integrationId);
    if (!integration || integration.status === "DISABLED") throw Errors.validation({ integrationId: ["The webhook was removed or disabled."] });
    for (const m of messages) {
      await ADAPTERS.WEBHOOK.publish({ secret: integration.secret, config: integration.config, payload: { event: "brandai.website_message", sentAt: now.toISOString(), website: m.website.name, message: { kind: m.kind, name: m.name, email: m.email, phone: m.phone, item: m.item, text: m.message, page: m.pagePath, receivedAt: m.createdAt } } });
    }
    return `Forwarded ${messages.length} website message${messages.length === 1 ? "" : "s"} to ${integration.name}.`;
  },
};

async function runRules(now, workspaceId) {
  const rules = await prisma.automationRule.findMany({ where: { enabled: true, deletedAt: null, ...(workspaceId ? { workspaceId } : {}) }, take: 500 });
  let ran = 0;
  for (const rule of rules) {
    const settings = await loadSettings(rule.workspaceId);
    try {
      const message = await RULE_HANDLERS[rule.template]?.(rule, { now, settings });
      if (message) await logRun(rule.workspaceId, { kind: "rule", outcome: "SUCCESS", message: `“${rule.name}”: ${message}`, ruleId: rule.id });
      if (message !== null) await prisma.automationRule.update({ where: { id: rule.id }, data: { lastRunAt: now } });
      ran++;
    } catch (error) {
      await logRun(rule.workspaceId, { kind: "rule", outcome: "FAILED", message: `“${rule.name}” failed: ${isAppError(error) ? error.message : "unexpected error"}`, ruleId: rule.id });
    }
  }
  return ran;
}

// ── Entry points ────────────────────────────────────────────────────────────

/** Runs everything that is due (all workspaces, or one for "Run now"). */
export async function runAutomation({ now = new Date(), workspaceId } = {}) {
  // One run at a time across all instances: daily limits are counted, then used.
  const release = await acquireLock("automation-runner");
  if (!release) return { skipped: true, reason: "Another automation run is in progress." };
  try {
    return await runLocked({ now, workspaceId });
  } finally {
    await release();
  }
}

async function runLocked({ now, workspaceId }) {
  const ws = workspaceId ? { workspaceId } : {};
  const summary = { published: 0, manual: 0, blocked: 0, postponed: 0, failed: 0, reminders: 0, rules: 0 };

  // Items left "publishing" by a crashed run are failed (never silently retried twice).
  const stale = await prisma.scheduledItem.findMany({ where: { ...ws, status: "PUBLISHING", lockedAt: { lt: new Date(now.getTime() - STALE_LOCK_MS) } }, select: { id: true, workspaceId: true, title: true } });
  for (const s of stale) {
    await prisma.scheduledItem.update({ where: { id: s.id }, data: { status: "FAILED", lockedAt: null, lastError: "The publishing run was interrupted. Check the channel before retrying." } });
    await logRun(s.workspaceId, { kind: "publish", outcome: "FAILED", message: `“${s.title}”: the publishing run was interrupted.`, itemId: s.id });
  }

  const due = await prisma.scheduledItem.findMany({ where: { ...ws, status: "APPROVED", deletedAt: null, scheduledAt: { lte: now } }, orderBy: { scheduledAt: "asc" }, take: 100 });
  for (const item of due) {
    if (!(await claim(item.id, ["APPROVED"], now))) continue;
    try {
      const r = await execute(item, { now });
      summary[r === "published" ? "published" : r === "manual" ? "manual" : r === "blocked" ? "blocked" : r === "postponed" ? "postponed" : "failed"]++;
    } catch (error) {
      summary.failed++;
      logger.error("Runner item error", { itemId: item.id, error: String(error) });
      await prisma.scheduledItem.update({ where: { id: item.id }, data: { status: "FAILED", lockedAt: null, lastError: "Unexpected error." } });
    }
  }

  const reminders = await prisma.reminder.findMany({ where: { ...ws, firedAt: null, doneAt: null, dueAt: { lte: now } }, take: 500 });
  for (const r of reminders) {
    const { count } = await prisma.reminder.updateMany({ where: { id: r.id, firedAt: null }, data: { firedAt: now } });
    if (!count) continue;
    await notify({ userId: r.userId, workspaceId: r.workspaceId, type: "reminder", title: r.title, body: r.note, link: r.link ?? "/automation" });
    await logRun(r.workspaceId, { kind: "reminder", outcome: "SUCCESS", message: `Reminder “${r.title}” sent.` });
    summary.reminders++;
  }

  summary.rules = await runRules(now, workspaceId);
  return summary;
}

/** "Run now" for one workspace (owners/admins). */
export async function runAutomationForWorkspace(user, workspaceId, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.AUTOMATION_MANAGE);
  const summary = await runAutomation({ workspaceId: scope.workspaceId });
  await recordAudit({ action: "automation.run_now", actorId: user.id, workspaceId, entityType: "workspace", entityId: scope.workspaceId, metadata: summary, request });
  return summary;
}

/** A person with approval rights publishes or sends an item immediately (explicit, audited authorization). */
export async function publishNow(user, workspaceId, id, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.AUTOMATION_APPROVE);
  if (!uuidSchema.safeParse(id).success) throw Errors.notFound();
  const item = await prisma.scheduledItem.findFirst({ where: { id, workspaceId: scope.workspaceId, deletedAt: null } });
  if (!item) throw Errors.notFound();
  if (!item.integrationId && item.sourceType !== "EMAIL_CAMPAIGN") throw new AppError("CONFLICT", "This item has no channel — post it yourself and mark it as posted.", 409);
  const settings = await loadSettings(scope.workspaceId);
  if (item.status === "PENDING_APPROVAL" && settings.requireSeparateApprover && item.requestedById === user.id) throw Errors.forbidden("Someone other than the person who scheduled it must approve it.");
  const now = new Date();
  if (!(await claim(item.id, ["APPROVED", "MANUAL_DUE", "FAILED", "PENDING_APPROVAL"], now))) throw new AppError("CONFLICT", "This item can't be published now.", 409);
  await prisma.scheduledItem.update({ where: { id: item.id }, data: { approvedById: item.approvedById ?? user.id, approvedAt: item.approvedAt ?? now } });
  const outcome = await execute({ ...item, approvedById: item.approvedById ?? user.id }, { now, authorizedBy: user.id });
  await recordAudit({ action: "automation.publish_now", actorId: user.id, workspaceId, entityType: "scheduled_item", entityId: item.id, metadata: { outcome }, request });
  return prisma.scheduledItem.findUnique({ where: { id: item.id } });
}
