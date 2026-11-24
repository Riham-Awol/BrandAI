import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { Errors } from "@/server/errors.js";
import { recordAudit } from "@/server/audit/service.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { findScopedBusiness } from "@/server/businesses/service.js";
import { createStudioEngine } from "@/server/studio/engine.js";
import { PLATFORMS, daysInMonth, normalizeHashtags } from "./platforms.js";
import { SECTION_SCHEMAS } from "./schemas.js";
import { SOCIAL_SECTIONS } from "./sections.js";
import { SOCIAL_AI_OPTIONS, buildInstructions, buildSocialInput } from "./prompts.js";
import "./mock-fixtures.js";

/** Pillar shares are re-normalized to 100% and calendar entries checked against the plan. */
export function postProcessSocial(section, data, { project } = {}) {
  if (section === "pillars") {
    const total = data.pillars.reduce((sum, p) => sum + Math.max(0, Number(p.share) || 0), 0);
    return {
      ...data,
      pillars: data.pillars.map((p) => ({ ...p, share: total > 0 ? Math.round((Math.max(0, Number(p.share) || 0) / total) * 100) : Math.round(100 / data.pillars.length) })),
      hashtagSets: data.hashtagSets.map((h) => ({ ...h, hashtags: normalizeHashtags(h.hashtags) })),
      platformPlans: data.platformPlans.map((p) => ({ ...p, postsPerWeek: Math.max(0, Math.min(21, Math.round(Number(p.postsPerWeek) || 0))) })),
    };
  }
  if (section === "calendar" && project) {
    const days = daysInMonth(project.input.month);
    const entries = data.entries
      .map((e) => ({ ...e, day: Math.round(Number(e.day)) }))
      .filter((e) => e.day >= 1 && e.day <= days && project.input.platforms.includes(e.platform) && PLATFORMS[e.platform].formats.includes(e.format))
      .map((e) => ({ ...e, isPromotion: project.input.includePromotions ? e.isPromotion : false }))
      .sort((a, b) => a.day - b.day);
    if (entries.length === 0) throw Errors.validation({ entries: ["No valid calendar entries for this month and these platforms."] });
    return { ...data, entries };
  }
  return data;
}

export const socialEngine = createStudioEngine({
  type: "SOCIAL_STUDIO",
  module: "social",
  sections: SOCIAL_SECTIONS,
  schemas: SECTION_SCHEMAS,
  aiOptions: SOCIAL_AI_OPTIONS,
  buildInstructions,
  buildInput: buildSocialInput,
  postProcess: postProcessSocial,
});

export async function createSocialProject(user, workspaceId, input, request) {
  const { businessId, ...settings } = input;
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const business = await findScopedBusiness(scope, businessId);
  const monthLabel = new Date(`${settings.month}-01T12:00:00Z`).toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" });
  const project = await prisma.project.create({
    data: { workspaceId: scope.workspaceId, businessId: business.id, type: "SOCIAL_STUDIO", name: `${business.name} — ${monthLabel}`, input: settings, createdById: user.id },
    select: { id: true, name: true, businessId: true, createdAt: true },
  });
  await recordAudit({ action: "social.project_created", actorId: user.id, workspaceId, entityType: "project", entityId: project.id, request });
  return project;
}

export const listSocialProjects = (user, workspaceId) => socialEngine.listProjects(user, workspaceId);
