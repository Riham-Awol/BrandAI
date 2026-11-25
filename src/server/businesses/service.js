import "server-only";
import { prisma } from "../db/prisma.js";
import { Errors } from "../errors.js";
import { recordAudit, AUDIT_ACTIONS } from "../audit/service.js";
import { requireWorkspaceAccess } from "../permissions/authorize.js";
import { assertPlanAllows } from "../billing/entitlements.js";
import { PERMISSIONS } from "../permissions/roles.js";
import { uuidSchema } from "@/validation/common.js";

const businessSelect = {
  id: true,
  workspaceId: true,
  name: true,
  industry: true,
  description: true,
  stage: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * Every query is constrained by workspaceId from an authorized scope, so a
 * business id from another workspace behaves exactly like a missing one.
 */
async function findScopedBusiness(scope, businessId) {
  if (!uuidSchema.safeParse(businessId).success) throw Errors.notFound();
  const business = await prisma.business.findFirst({
    where: { id: businessId, workspaceId: scope.workspaceId, deletedAt: null },
    select: businessSelect,
  });
  if (!business) throw Errors.notFound();
  return business;
}

export async function listBusinesses(user, workspaceId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  return prisma.business.findMany({
    where: { workspaceId: scope.workspaceId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: businessSelect,
  });
}

export async function getBusiness(user, workspaceId, businessId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  return findScopedBusiness(scope, businessId);
}

export async function createBusiness(user, workspaceId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_CREATE);
  await assertPlanAllows(scope.workspaceId, "businesses");
  const business = await prisma.business.create({
    data: { ...input, workspaceId: scope.workspaceId, createdById: user.id },
    select: businessSelect,
  });
  await recordAudit({ action: AUDIT_ACTIONS.BUSINESS_CREATED, actorId: user.id, workspaceId, entityType: "business", entityId: business.id, request });
  return business;
}

export async function updateBusiness(user, workspaceId, businessId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  await findScopedBusiness(scope, businessId);
  const business = await prisma.business.update({ where: { id: businessId }, data: input, select: businessSelect });
  await recordAudit({
    action: AUDIT_ACTIONS.BUSINESS_UPDATED, actorId: user.id, workspaceId, entityType: "business", entityId: businessId,
    metadata: { fields: Object.keys(input) }, request,
  });
  return business;
}

/** Soft delete: data is retained for recovery and audit. */
export async function deleteBusiness(user, workspaceId, businessId, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_DELETE);
  await findScopedBusiness(scope, businessId);
  await prisma.business.update({ where: { id: businessId }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
  await recordAudit({ action: AUDIT_ACTIONS.BUSINESS_DELETED, actorId: user.id, workspaceId, entityType: "business", entityId: businessId, request });
}

export { findScopedBusiness };
