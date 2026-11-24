import "server-only";
import { prisma } from "../db/prisma.js";
import { recordAudit } from "../audit/service.js";
import { requireWorkspaceAccess } from "../permissions/authorize.js";
import { PERMISSIONS } from "../permissions/roles.js";
import { findScopedBusiness } from "./service.js";
import { saveContextDraft, getContextOverview, getApprovedSectionsExcept } from "./context-service.js";
import { buildContextFromProfile } from "./profile-utils.js";

const order = { orderBy: { sortOrder: "asc" } };
const PROFILE_SECTIONS = ["basics", "offering", "audience", "goals", "competitors"];
const strip = ({ id: _id, businessId: _b, createdAt: _c, updatedAt: _u, sortOrder: _s, ...rest }) =>
  Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v ?? undefined]));

async function loadProfile(businessId) {
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      products: order,
      services: order,
      locations: { orderBy: { createdAt: "asc" } },
      audiences: order,
      problems: order,
      competitors: order,
      goals: order,
    },
  });
  return {
    id: b.id,
    name: b.name,
    industry: b.industry ?? undefined,
    description: b.description ?? undefined,
    stage: b.stage,
    status: b.status,
    valueProposition: b.valueProposition ?? undefined,
    businessModel: b.businessModel ?? undefined,
    products: b.products.map(strip),
    services: b.services.map(strip),
    locations: b.locations.map(strip),
    audiences: b.audiences.map(strip),
    problems: b.problems.map(strip),
    competitors: b.competitors.map(strip),
    goals: b.goals.map(strip),
    updatedAt: b.updatedAt,
  };
}

export async function getBusinessProfile(user, workspaceId, businessId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  await findScopedBusiness(scope, businessId);
  const [profile, context] = await Promise.all([loadProfile(businessId), getContextOverview(user, workspaceId, businessId)]);
  return {
    profile,
    context,
    permissions: { canEdit: scope.can(PERMISSIONS.BUSINESS_UPDATE), canApprove: scope.can(PERMISSIONS.CONTEXT_APPROVE) },
  };
}

/**
 * Replaces the structured profile (lists are replaced as a whole) and saves
 * the matching central-context draft. Approval is a separate, explicit step.
 */
export async function saveBusinessProfile(user, workspaceId, businessId, profile, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  await findScopedBusiness(scope, businessId);
  const withOrder = (items) => items.map((item, i) => ({ ...item, businessId, sortOrder: i }));
  const primaryFirst = (items) => {
    let seen = false;
    return items.map((item) => {
      const isPrimary = item.isPrimary && !seen;
      if (isPrimary) seen = true;
      return { ...item, isPrimary };
    });
  };

  await prisma.$transaction(async (tx) => {
    await tx.business.update({
      where: { id: businessId },
      data: {
        name: profile.name,
        industry: profile.industry ?? null,
        description: profile.description ?? null,
        stage: profile.stage,
        valueProposition: profile.valueProposition ?? null,
        businessModel: profile.businessModel ?? null,
        status: "ACTIVE",
      },
    });
    const lists = [
      ["businessProduct", withOrder(profile.products)],
      ["businessService", withOrder(profile.services)],
      ["businessLocation", primaryFirst(profile.locations).map((l) => ({ ...l, businessId }))],
      ["businessAudience", withOrder(primaryFirst(profile.audiences))],
      ["businessCustomerProblem", withOrder(profile.problems)],
      ["competitor", withOrder(profile.competitors)],
      ["businessGoal", withOrder(profile.goals)],
    ];
    for (const [model, rows] of lists) {
      await tx[model].deleteMany({ where: { businessId } });
      if (rows.length) await tx[model].createMany({ data: rows });
    }
  });

  const saved = await loadProfile(businessId);
  // Sections owned by other studios (brand identity, voice…) are carried over unchanged.
  const carried = await getApprovedSectionsExcept(businessId, PROFILE_SECTIONS);
  const draft = await saveContextDraft(user, workspaceId, businessId, { data: { ...carried, ...buildContextFromProfile(saved) }, changeNote: "Updated from business profile" }, request);
  await recordAudit({ action: "business.profile_saved", actorId: user.id, workspaceId, entityType: "business", entityId: businessId, request });
  return { profile: saved, contextDraft: { id: draft.id, version: draft.version } };
}
