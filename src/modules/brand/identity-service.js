import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { AppError } from "@/server/errors.js";
import { recordAudit } from "@/server/audit/service.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { findScopedBusiness } from "@/server/businesses/service.js";
import { publishApprovedSections } from "@/server/businesses/context-service.js";
import { FONT_BY_KEY } from "./catalog/fonts.js";
import { SELECTABLE } from "./schemas.js";
import { BRAND_SECTION_BY_KEY, REQUIRED_FOR_APPROVAL } from "./sections.js";
import { brandEngine } from "./service.js";

function pick(active, section) {
  const row = active[section];
  if (!row) return null;
  const listKey = SELECTABLE[section];
  if (!listKey) return row.content;
  const items = row.content[listKey] ?? [];
  return items[Math.min(row.state?.selected ?? 0, items.length - 1)] ?? null;
}

/** Builds the identity from the studio's active outputs and selections (pure apart from inputs). */
export function assembleIdentity(active, business) {
  const missing = REQUIRED_FOR_APPROVAL.filter((s) => !active[s]).map((s) => BRAND_SECTION_BY_KEY[s].title);
  const palette = pick(active, "palettes");
  const pairing = pick(active, "typography");
  const tagline = pick(active, "taglines");
  return {
    complete: missing.length === 0,
    missing,
    data: {
      businessName: business.name,
      tagline: tagline?.text ?? null,
      logo: pick(active, "logo_concepts"),
      palette: palette ? { name: palette.name, mood: palette.mood, colors: palette.colors, usageNotes: palette.usageNotes } : null,
      typography: pairing
        ? { name: pairing.name, heading: { fontKey: pairing.headingFont, weight: pairing.headingWeight }, body: { fontKey: pairing.bodyFont, weight: pairing.bodyWeight } }
        : null,
      personality: active.personality?.content ?? null,
      voice: active.voice?.content ?? null,
      guidelines: active.guidelines?.content ?? null,
    },
  };
}

/** Context sections derived from an identity — what other studios receive. */
export function identityToContext(data) {
  const family = (t) => (t ? `${FONT_BY_KEY[t.fontKey]?.family ?? t.fontKey} ${t.weight}` : undefined);
  return {
    brandIdentity: {
      tagline: data.tagline ?? undefined,
      colors: data.palette?.colors,
      paletteName: data.palette?.name,
      typography: data.typography ? { heading: family(data.typography.heading), body: family(data.typography.body) } : undefined,
      logo: data.logo ? { concept: data.logo.name, style: data.logo.markType, icon: data.logo.icon || undefined, description: data.logo.rationale } : undefined,
      personality: data.personality
        ? { archetype: data.personality.archetype, traits: data.personality.traits, brandPromise: data.personality.brandPromise, mission: data.personality.mission, values: data.personality.values?.map((v) => v.name) }
        : undefined,
    },
    brandVoice: data.voice
      ? {
          summary: data.voice.summary,
          tone: data.voice.toneAttributes?.map((t) => ({ attribute: t.attribute, description: t.description })),
          preferredWords: data.voice.vocabulary?.preferred,
          avoidWords: data.voice.vocabulary?.avoid,
          writingGuidelines: data.voice.writingGuidelines,
          weAre: data.personality?.weAre,
          weAreNot: data.personality?.weAreNot,
        }
      : undefined,
  };
}

async function latestApproved(businessId) {
  return prisma.brandIdentity.findFirst({ where: { businessId, status: "APPROVED" }, orderBy: { version: "desc" } });
}

export async function getIdentityOverview(user, workspaceId, projectId) {
  const { project, active } = await brandEngine.getActiveContent(user, workspaceId, projectId);
  const draft = assembleIdentity(active, project.business);
  const approved = await latestApproved(project.businessId);
  return { draft, approved: approved ? { id: approved.id, version: approved.version, approvedAt: approved.approvedAt, data: approved.data } : null };
}

/** Approves the assembled identity: new immutable version + context publication. */
export async function approveIdentity(user, workspaceId, projectId, request) {
  const { project, active } = await brandEngine.getActiveContent(user, workspaceId, projectId);
  await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.CONTEXT_APPROVE);
  const { complete, missing, data } = assembleIdentity(active, project.business);
  if (!complete) throw new AppError("CONFLICT", `Generate these sections first: ${missing.join(", ")}.`, 409, { missing });

  const identity = await prisma.$transaction(async (tx) => {
    const last = await tx.brandIdentity.findFirst({ where: { businessId: project.businessId }, orderBy: { version: "desc" }, select: { version: true } });
    await tx.brandIdentity.updateMany({ where: { businessId: project.businessId, status: "APPROVED" }, data: { status: "SUPERSEDED" } });
    return tx.brandIdentity.create({
      data: {
        workspaceId: project.workspaceId, businessId: project.businessId, projectId: project.id, version: (last?.version ?? 0) + 1,
        data, createdById: user.id, approvedById: user.id,
      },
    });
  });
  const context = Object.fromEntries(Object.entries(identityToContext(data)).filter(([, v]) => v));
  await publishApprovedSections(user, workspaceId, project.businessId, context, request);
  await recordAudit({ action: "brand.identity_approved", actorId: user.id, workspaceId, entityType: "brand_identity", entityId: identity.id, metadata: { version: identity.version }, request });
  return { id: identity.id, version: identity.version, data };
}

export async function getCurrentIdentity(user, workspaceId, businessId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const business = await findScopedBusiness(scope, businessId);
  const identity = await latestApproved(business.id);
  return { business, identity: identity ? { id: identity.id, version: identity.version, approvedAt: identity.approvedAt, data: identity.data, projectId: identity.projectId } : null };
}
