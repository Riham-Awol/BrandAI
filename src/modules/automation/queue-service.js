import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { AppError, Errors } from "@/server/errors.js";
import { recordAudit } from "@/server/audit/service.js";
import { notify } from "@/server/notifications/service.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { findScopedBusiness } from "@/server/businesses/service.js";
import { uuidSchema } from "@/validation/common.js";
import { composeCaption } from "@/modules/social/platforms.js";
import { loadSettings } from "./settings-service.js";
import { logRun } from "./history.js";

/**
 * The content queue: planned outward actions with an approval workflow.
 *
 *   submit → DRAFT_ONLY:          APPROVED (the runner only reminds; never publishes)
 *          → APPROVAL_REQUIRED:   PENDING_APPROVAL → approve (owner/admin) → APPROVED
 *          → AUTOMATED:           APPROVED by policy (runner publishes within limits)
 *
 * The runner re-checks the mode at publish time, so tightening the policy
 * applies to items already scheduled.
 */

const itemSelect = {
  id: true, businessId: true, title: true, sourceType: true, sourceId: true, integrationId: true, content: true, scheduledAt: true, status: true,
  requestedById: true, approvedById: true, approvedAt: true, decisionNote: true, publishedAt: true, externalUrl: true, attempts: true, lastError: true, createdAt: true, updatedAt: true,
  integration: { select: { id: true, name: true, type: true, status: true } },
  business: { select: { id: true, name: true } },
};

async function findItem(scope, id) {
  if (!uuidSchema.safeParse(id).success) throw Errors.notFound();
  const item = await prisma.scheduledItem.findFirst({ where: { id, workspaceId: scope.workspaceId, deletedAt: null }, select: itemSelect });
  if (!item) throw Errors.notFound();
  return item;
}

async function approvers(workspaceId) {
  const members = await prisma.workspaceMember.findMany({ where: { workspaceId, role: { in: ["OWNER", "ADMIN"] } }, select: { userId: true } });
  return members.map((m) => m.userId);
}

/** Content snapshot from the source (what will actually be sent). */
async function snapshot(scope, businessId, input) {
  if (input.sourceType === "SOCIAL_POST") {
    if (!input.sourceId) throw Errors.validation({ sourceId: ["Choose a post."] });
    const post = await prisma.socialPost.findFirst({ where: { id: input.sourceId, workspaceId: scope.workspaceId, businessId, deletedAt: null } });
    if (!post) throw Errors.notFound();
    if (!post.content) throw Errors.validation({ sourceId: ["Write the post before scheduling it."] });
    return { title: input.title ?? post.title, content: { text: input.text ?? composeCaption(post.content), link: input.link ?? null, platform: post.platform, format: post.format, altText: post.content.altText ?? null } };
  }
  if (input.sourceType === "EMAIL_CAMPAIGN") {
    if (!input.sourceId) throw Errors.validation({ sourceId: ["Choose a campaign."] });
    const c = await prisma.emailCampaign.findFirst({ where: { id: input.sourceId, workspaceId: scope.workspaceId, businessId, deletedAt: null } });
    if (!c) throw Errors.notFound();
    if (c.status === "SENT" || c.status === "SENDING") throw new AppError("CONFLICT", "This campaign has already been sent.", 409);
    return { title: input.title ?? `Email: ${c.name}`, content: { text: c.subject, campaignId: c.id } };
  }
  if (!input.text?.trim()) throw Errors.validation({ text: ["Write the post text."] });
  return { title: input.title ?? input.text.slice(0, 80), content: { text: input.text, link: input.link ?? null } };
}

/** Status after submitting, under the current mode. */
async function submittedStatus(scope, user) {
  const settings = await loadSettings(scope.workspaceId);
  if (settings.mode === "APPROVAL_REQUIRED") {
    const selfApprove = scope.can(PERMISSIONS.AUTOMATION_APPROVE) && !settings.requireSeparateApprover;
    return selfApprove ? { status: "APPROVED", approvedById: user.id, approvedAt: new Date(), note: "Approved by the scheduler (owner/admin)." } : { status: "PENDING_APPROVAL" };
  }
  return { status: "APPROVED", approvedById: null, approvedAt: new Date(), note: settings.mode === "AUTOMATED" ? "Approved by policy (authorized automation)." : "Planned (draft-only mode: you'll be reminded to post it)." };
}

export async function scheduleItem(user, workspaceId, input, request, { viaRule } = {}) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const business = await findScopedBusiness(scope, input.businessId);
  if (input.integrationId) {
    const integration = await prisma.integration.findFirst({ where: { id: input.integrationId, workspaceId: scope.workspaceId, deletedAt: null } });
    if (!integration) throw Errors.validation({ integrationId: ["Choose a connected channel."] });
  }
  if (input.sourceType === "EMAIL_CAMPAIGN" && input.integrationId) throw Errors.validation({ integrationId: ["Campaigns are sent by email, not through a channel."] });
  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) throw Errors.validation({ scheduledAt: ["Choose a date and time."] });
  const snap = await snapshot(scope, business.id, input);
  const decision = input.submit ? await submittedStatus(scope, user) : { status: "DRAFT" };
  const item = await prisma.scheduledItem.create({
    data: {
      workspaceId: scope.workspaceId, businessId: business.id, title: snap.title.slice(0, 200), sourceType: input.sourceType, sourceId: input.sourceId ?? null,
      integrationId: input.integrationId ?? null, content: snap.content, scheduledAt, status: decision.status, requestedById: user.id,
      approvedById: decision.approvedById ?? null, approvedAt: decision.approvedAt ?? null, decisionNote: decision.note ?? null,
    },
    select: { id: true, status: true, title: true },
  });
  if (input.sourceType === "EMAIL_CAMPAIGN") await prisma.emailCampaign.update({ where: { id: input.sourceId }, data: { status: "SCHEDULED" } });
  if (item.status === "PENDING_APPROVAL") {
    for (const userId of await approvers(scope.workspaceId)) {
      if (userId !== user.id) await notify({ userId, workspaceId: scope.workspaceId, type: "automation.approval", title: `Approval needed: ${item.title}`, body: `Scheduled for ${scheduledAt.toISOString().slice(0, 16).replace("T", " ")} UTC`, link: "/automation/queue" });
    }
  }
  await logRun(scope.workspaceId, { kind: viaRule ? "rule" : "schedule", outcome: "SUCCESS", message: `“${item.title}” scheduled → ${item.status}${decision.note ? ` (${decision.note})` : ""}.`, itemId: item.id, actorId: user.id, ruleId: viaRule });
  await recordAudit({ action: "automation.item_scheduled", actorId: user.id, workspaceId, entityType: "scheduled_item", entityId: item.id, metadata: { status: item.status }, request });
  return getItem(user, workspaceId, item.id);
}

export async function getItem(user, workspaceId, id) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const item = await findItem(scope, id);
  return { ...item, permissions: { canEdit: scope.can(PERMISSIONS.BUSINESS_UPDATE), canApprove: scope.can(PERMISSIONS.AUTOMATION_APPROVE) } };
}

export async function listItems(user, workspaceId, { from, to, status } = {}) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  return prisma.scheduledItem.findMany({
    where: {
      workspaceId: scope.workspaceId, deletedAt: null,
      ...(status ? { status: { in: String(status).split(",") } } : {}),
      ...(from || to ? { scheduledAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lt: new Date(to) } : {}) } } : {}),
    },
    orderBy: { scheduledAt: "asc" },
    take: 500,
    select: itemSelect,
  });
}

/** Submits a draft item under the current policy. */
export async function submitItem(user, workspaceId, id, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const item = await findItem(scope, id);
  if (!["DRAFT", "REJECTED"].includes(item.status)) throw new AppError("CONFLICT", "Only drafts and rejected items can be submitted.", 409);
  const decision = await submittedStatus(scope, user);
  await prisma.scheduledItem.update({ where: { id: item.id }, data: { status: decision.status, approvedById: decision.approvedById ?? null, approvedAt: decision.approvedAt ?? null, decisionNote: decision.note ?? null } });
  await logRun(scope.workspaceId, { kind: "schedule", outcome: "SUCCESS", message: `“${item.title}” submitted → ${decision.status}.`, itemId: item.id, actorId: user.id });
  await recordAudit({ action: "automation.item_submitted", actorId: user.id, workspaceId, entityType: "scheduled_item", entityId: item.id, request });
  return getItem(user, workspaceId, item.id);
}

export async function decideItem(user, workspaceId, id, { approve, note }, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.AUTOMATION_APPROVE);
  const item = await findItem(scope, id);
  if (item.status !== "PENDING_APPROVAL") throw new AppError("CONFLICT", "This item is not waiting for approval.", 409);
  const settings = await loadSettings(scope.workspaceId);
  if (approve && settings.requireSeparateApprover && item.requestedById === user.id) throw Errors.forbidden("Someone other than the person who scheduled it must approve it.");
  await prisma.scheduledItem.update({ where: { id: item.id }, data: approve ? { status: "APPROVED", approvedById: user.id, approvedAt: new Date(), decisionNote: note ?? null } : { status: "REJECTED", decisionNote: note ?? null } });
  if (item.requestedById !== user.id) {
    await notify({ userId: item.requestedById, workspaceId: scope.workspaceId, type: "automation.decision", title: `${approve ? "Approved" : "Rejected"}: ${item.title}`, body: note ?? null, link: "/automation/queue" });
  }
  await logRun(scope.workspaceId, { kind: "approval", outcome: "SUCCESS", message: `“${item.title}” ${approve ? "approved" : "rejected"}${note ? `: ${note}` : ""}.`, itemId: item.id, actorId: user.id });
  await recordAudit({ action: approve ? "automation.item_approved" : "automation.item_rejected", actorId: user.id, workspaceId, entityType: "scheduled_item", entityId: item.id, request });
  return getItem(user, workspaceId, item.id);
}

/** Moving an item needs a fresh approval in approval mode (the time is part of what was approved). */
export async function rescheduleItem(user, workspaceId, id, scheduledAt, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const item = await findItem(scope, id);
  if (!["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "FAILED", "MANUAL_DUE"].includes(item.status)) throw new AppError("CONFLICT", "This item can't be rescheduled.", 409);
  const wasLive = ["APPROVED", "FAILED", "MANUAL_DUE"].includes(item.status);
  const decision = wasLive ? await submittedStatus(scope, user) : { status: item.status };
  await prisma.scheduledItem.update({ where: { id: item.id }, data: { scheduledAt: new Date(scheduledAt), status: decision.status, attempts: 0, lastError: null, ...(wasLive ? { approvedById: decision.approvedById ?? null, approvedAt: decision.approvedAt ?? null, decisionNote: decision.note ?? null } : {}) } });
  await logRun(scope.workspaceId, { kind: "schedule", outcome: "SUCCESS", message: `“${item.title}” moved to ${new Date(scheduledAt).toISOString().slice(0, 16).replace("T", " ")} UTC → ${decision.status}.`, itemId: item.id, actorId: user.id });
  await recordAudit({ action: "automation.item_rescheduled", actorId: user.id, workspaceId, entityType: "scheduled_item", entityId: item.id, request });
  return getItem(user, workspaceId, item.id);
}

export async function cancelItem(user, workspaceId, id, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const item = await findItem(scope, id);
  if (["PUBLISHED", "PUBLISHING", "CANCELLED"].includes(item.status)) throw new AppError("CONFLICT", "This item can't be cancelled.", 409);
  await prisma.scheduledItem.update({ where: { id: item.id }, data: { status: "CANCELLED" } });
  if (item.sourceType === "EMAIL_CAMPAIGN" && item.sourceId) await prisma.emailCampaign.updateMany({ where: { id: item.sourceId, status: "SCHEDULED" }, data: { status: "DRAFT" } });
  await logRun(scope.workspaceId, { kind: "schedule", outcome: "SUCCESS", message: `“${item.title}” cancelled.`, itemId: item.id, actorId: user.id });
  await recordAudit({ action: "automation.item_cancelled", actorId: user.id, workspaceId, entityType: "scheduled_item", entityId: item.id, request });
  return getItem(user, workspaceId, item.id);
}

/** A person confirms they posted a "post manually" item (optionally with its URL). */
export async function markPosted(user, workspaceId, id, { externalUrl }, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const item = await findItem(scope, id);
  if (!["MANUAL_DUE", "APPROVED", "FAILED"].includes(item.status)) throw new AppError("CONFLICT", "This item can't be marked as posted.", 409);
  await prisma.scheduledItem.update({ where: { id: item.id }, data: { status: "PUBLISHED", publishedAt: new Date(), externalUrl: externalUrl ?? null } });
  await logRun(scope.workspaceId, { kind: "publish", outcome: "SUCCESS", message: `“${item.title}” marked as posted manually.`, itemId: item.id, actorId: user.id });
  await recordAudit({ action: "automation.item_marked_posted", actorId: user.id, workspaceId, entityType: "scheduled_item", entityId: item.id, request });
  return getItem(user, workspaceId, item.id);
}

/** Things that can be scheduled for a business: written social posts and draft campaigns. */
export async function listSchedulableSources(user, workspaceId, businessId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  await findScopedBusiness(scope, businessId);
  const [posts, campaigns] = await Promise.all([
    prisma.socialPost.findMany({ where: { workspaceId: scope.workspaceId, businessId, deletedAt: null, status: { in: ["DRAFT", "READY"] } }, orderBy: { scheduledDate: "asc" }, take: 200, select: { id: true, title: true, scheduledDate: true, platform: true, status: true } }),
    prisma.emailCampaign.findMany({ where: { workspaceId: scope.workspaceId, businessId, deletedAt: null, status: "DRAFT" }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, name: true, subject: true } }),
  ]);
  return { posts: posts.map((p) => ({ ...p, scheduledDate: p.scheduledDate.toISOString().slice(0, 10) })), campaigns };
}
