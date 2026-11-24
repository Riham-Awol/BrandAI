import "server-only";
import { prisma } from "../db/prisma.js";
import { Errors } from "../errors.js";
import { recordAudit, AUDIT_ACTIONS } from "../audit/service.js";
import { requireWorkspaceAccess } from "../permissions/authorize.js";
import { PERMISSIONS } from "../permissions/roles.js";
import { findScopedBusiness } from "./service.js";
import { pickApprovedSections } from "./context-utils.js";

/**
 * Central Business Context.
 *
 * Users edit a DRAFT version; approving it (all or selected sections) makes it
 * the APPROVED version and supersedes the previous one. AI modules call
 * getApprovedContext() and only ever see approved sections.
 */

async function latestVersion(businessId, status) {
  return prisma.businessContextVersion.findFirst({
    where: { businessId, ...(status ? { status } : {}) },
    orderBy: { version: "desc" },
  });
}

export async function getContextOverview(user, workspaceId, businessId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  await findScopedBusiness(scope, businessId);
  const [draft, approved] = await Promise.all([latestVersion(businessId, "DRAFT"), latestVersion(businessId, "APPROVED")]);
  return { draft, approved };
}

/** Creates or replaces the current draft (one open draft per business). */
export async function saveContextDraft(user, workspaceId, businessId, { data, changeNote }, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  await findScopedBusiness(scope, businessId);

  const draft = await prisma.$transaction(async (tx) => {
    const existing = await tx.businessContextVersion.findFirst({ where: { businessId, status: "DRAFT" }, orderBy: { version: "desc" } });
    if (existing) {
      return tx.businessContextVersion.update({ where: { id: existing.id }, data: { data, changeNote, createdById: user.id } });
    }
    const last = await tx.businessContextVersion.findFirst({ where: { businessId }, orderBy: { version: "desc" }, select: { version: true } });
    return tx.businessContextVersion.create({
      data: { businessId, version: (last?.version ?? 0) + 1, status: "DRAFT", data, approvedSections: [], changeNote, createdById: user.id },
    });
  });
  await recordAudit({ action: AUDIT_ACTIONS.CONTEXT_DRAFT_SAVED, actorId: user.id, workspaceId, entityType: "business_context_version", entityId: draft.id, request });
  return draft;
}

/** Approves the open draft for reuse by AI modules. */
export async function approveContextDraft(user, workspaceId, businessId, { sections }, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.CONTEXT_APPROVE);
  await findScopedBusiness(scope, businessId);

  const approved = await prisma.$transaction(async (tx) => {
    const draft = await tx.businessContextVersion.findFirst({ where: { businessId, status: "DRAFT" }, orderBy: { version: "desc" } });
    if (!draft) throw Errors.conflict("There is no draft to approve.");
    await tx.businessContextVersion.updateMany({ where: { businessId, status: "APPROVED" }, data: { status: "SUPERSEDED" } });
    return tx.businessContextVersion.update({
      where: { id: draft.id },
      data: { status: "APPROVED", approvedSections: sections, approvedById: user.id, approvedAt: new Date() },
    });
  });
  await recordAudit({
    action: AUDIT_ACTIONS.CONTEXT_APPROVED, actorId: user.id, workspaceId, entityType: "business_context_version", entityId: approved.id,
    metadata: { version: approved.version, sections }, request,
  });
  return approved;
}

/**
 * Internal: the approved context for AI prompts. Callers must already hold an
 * authorized workspace scope (the AI orchestrator does).
 */
export async function getApprovedContext(scope, businessId) {
  await findScopedBusiness(scope, businessId);
  const approved = await latestVersion(businessId, "APPROVED");
  if (!approved) return null;
  return { versionId: approved.id, version: approved.version, data: pickApprovedSections(approved.data, approved.approvedSections) };
}
