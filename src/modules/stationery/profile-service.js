import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { recordAudit } from "@/server/audit/service.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { findScopedBusiness } from "@/server/businesses/service.js";
import { createStudioEngine } from "@/server/studio/engine.js";
import { resolveSiteBrand } from "@/server/brand/approved-brand.js";
import { PROFILE_SCHEMAS } from "./profile-schemas.js";
import { PROFILE_SECTIONS } from "./profile-sections.js";
import { profileInput, profileInstructions } from "./profile-prompts.js";
import { loadDetails, presentDetails } from "./details-service.js";
import "./mock-fixtures.js";

const clean = (v) => String(v ?? "").trim();

/** Trims text and caps list lengths so the brochure layout stays balanced. Pure. */
export function postProcessProfile(section, data) {
  if (section === "overview") return { ...data, headline: clean(data.headline), values: data.values.filter((v) => clean(v.name)).slice(0, 5) };
  if (section === "offering") {
    return {
      ...data,
      offerings: data.offerings.filter((o) => clean(o.name)).slice(0, 6).map((o) => ({ ...o, benefits: o.benefits.map(clean).filter(Boolean).slice(0, 3) })),
      whyChooseUs: data.whyChooseUs.filter((w) => clean(w.title)).slice(0, 4),
      process: data.process.filter((p) => clean(p.step)).slice(0, 5),
    };
  }
  return { ...data, commitments: data.commitments.map(clean).filter(Boolean).slice(0, 4) };
}

export const profileEngine = createStudioEngine({
  type: "COMPANY_PROFILE",
  module: "company_profile",
  sections: PROFILE_SECTIONS,
  schemas: PROFILE_SCHEMAS,
  aiOptions: { overview: { effort: "medium", maxTokens: 3000 }, offering: { effort: "medium", maxTokens: 4000 }, closing: { effort: "low", maxTokens: 2000 } },
  buildInstructions: (section) => profileInstructions(section),
  buildInput: profileInput,
  postProcess: postProcessProfile,
});

export async function createCompanyProfile(user, workspaceId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const business = await findScopedBusiness(scope, input.businessId);
  const project = await prisma.project.create({
    data: { workspaceId: scope.workspaceId, businessId: business.id, type: "COMPANY_PROFILE", name: `${business.name} company profile`, input: { purpose: input.purpose ?? null }, createdById: user.id },
    select: { id: true, name: true, businessId: true, createdAt: true },
  });
  await recordAudit({ action: "company_profile.created", actorId: user.id, workspaceId, entityType: "project", entityId: project.id, request });
  return project;
}

export const listCompanyProfiles = (user, workspaceId) => profileEngine.listProjects(user, workspaceId);

/** Brochure data: active (accepted, else latest) section content + brand + details. */
export async function getPrintableProfile(user, workspaceId, projectId) {
  const { project, active } = await profileEngine.getActiveContent(user, workspaceId, projectId);
  const [brand, details] = await Promise.all([resolveSiteBrand(project.businessId, project.business), loadDetails(project.businessId)]);
  const content = Object.fromEntries(PROFILE_SECTIONS.map((s) => [s.key, active[s.key]?.content ?? null]));
  const isMock = PROFILE_SECTIONS.some((s) => active[s.key]?.isMock);
  return { project: { id: project.id, name: project.name }, content, brand, details: presentDetails(details, project.business), isMock };
}
