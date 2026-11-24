import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { Errors } from "@/server/errors.js";
import { recordAudit } from "@/server/audit/service.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { findScopedBusiness } from "@/server/businesses/service.js";
import { createStudioEngine } from "@/server/studio/engine.js";
import { ICON_SET } from "./catalog/icons.js";
import { nearestWeight } from "./catalog/fonts.js";
import { normalizeHex } from "./color.js";
import { SECTION_SCHEMAS, SELECTABLE, selectionStateSchema } from "./schemas.js";
import { BRAND_SECTIONS } from "./sections.js";
import { BRAND_AI_OPTIONS, buildBrandInput, buildInstructions } from "./prompts.js";
import "./mock-fixtures.js";

function hexOrThrow(value, path) {
  const hex = normalizeHex(value);
  if (!hex) throw Errors.validation({ [path]: ["Enter a 6-digit hex colour such as #1F2A44."] });
  return hex;
}

/** Normalizes and repairs a logo concept so it can always be rendered. */
export function normalizeConcept(c, path = "concept") {
  const colors = Object.fromEntries(Object.entries(c.colors).map(([k, v]) => [k, hexOrThrow(v, `${path}.colors.${k}`)]));
  let { markType, icon } = c;
  if (markType === "icon" && !ICON_SET.has(icon)) {
    const match = [...ICON_SET].find((n) => n.toLowerCase() === String(icon).toLowerCase().replace(/[\s_-]/g, ""));
    if (match) icon = match;
    else markType = "monogram";
  }
  return {
    ...c,
    markType,
    icon: markType === "icon" ? icon : "",
    monogram: String(c.monogram ?? "").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2),
    fontWeight: String(nearestWeight(c.fontKey, c.fontWeight)),
    letterSpacing: Math.min(0.3, Math.max(-0.05, Number(c.letterSpacing) || 0)),
    colors,
  };
}

export function postProcessBrand(section, data) {
  if (section === "palettes") {
    return { ...data, palettes: data.palettes.map((p, i) => ({ ...p, colors: Object.fromEntries(Object.entries(p.colors).map(([k, v]) => [k, hexOrThrow(v, `palettes.${i}.colors.${k}`)])) })) };
  }
  if (section === "logo_concepts") {
    return { ...data, concepts: data.concepts.map((c, i) => normalizeConcept(c, `concepts.${i}`)) };
  }
  if (section === "typography") {
    return {
      ...data,
      pairings: data.pairings.map((p) => ({ ...p, headingWeight: String(nearestWeight(p.headingFont, p.headingWeight)), bodyWeight: String(nearestWeight(p.bodyFont, p.bodyWeight)) })),
    };
  }
  return data;
}

export const brandEngine = createStudioEngine({
  type: "BRAND_STUDIO",
  module: "brand",
  sections: BRAND_SECTIONS,
  schemas: SECTION_SCHEMAS,
  aiOptions: BRAND_AI_OPTIONS,
  buildInstructions: (section) => buildInstructions(section),
  buildInput: buildBrandInput,
  postProcess: postProcessBrand,
  validateState: (section, state, content) => {
    const listKey = SELECTABLE[section];
    if (!listKey) throw Errors.validation({ state: ["This section has no selectable options."] });
    const parsed = selectionStateSchema.safeParse(state);
    if (!parsed.success || parsed.data.selected >= (content[listKey]?.length ?? 0)) throw Errors.validation({ selected: ["Choose one of the available options."] });
    return { selected: parsed.data.selected };
  },
});

export async function createBrandProject(user, workspaceId, input, request) {
  const { businessId, ...preferences } = input;
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const business = await findScopedBusiness(scope, businessId);
  const project = await prisma.project.create({
    data: { workspaceId: scope.workspaceId, businessId: business.id, type: "BRAND_STUDIO", name: `${business.name} brand identity`, input: preferences, createdById: user.id },
    select: { id: true, name: true, businessId: true, createdAt: true },
  });
  await recordAudit({ action: "brand.project_created", actorId: user.id, workspaceId, entityType: "project", entityId: project.id, request });
  return project;
}

export const listBrandProjects = (user, workspaceId, options) => brandEngine.listProjects(user, workspaceId, options);
export const getBrandProject = brandEngine.getProject;
