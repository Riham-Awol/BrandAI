import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { Errors } from "@/server/errors.js";
import { recordAudit } from "@/server/audit/service.js";
import { generateText } from "@/server/ai/orchestrator.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { findScopedBusiness } from "@/server/businesses/service.js";
import { resolveBrand } from "@/server/brand/approved-brand.js";
import { renderMaterial } from "@/server/stationery/renderer.js";
import { uuidSchema } from "@/validation/common.js";
import { MATERIAL_KINDS } from "./catalog.js";
import { aiMaterialOptionsSchema, materialSpecSchema } from "./schemas.js";
import { blankSpec, normalizeMaterialSpec, templateOptions } from "./spec-utils.js";
import { materialInput, materialInstructions } from "./prompts.js";
import { loadDetails, presentDetails } from "./details-service.js";
import "./mock-fixtures.js";

const select = {
  id: true, businessId: true, kind: true, name: true, spec: true, version: true, isMock: true, createdAt: true, updatedAt: true,
  business: { select: { id: true, name: true, industry: true } },
};

async function findMaterial(scope, id) {
  if (!uuidSchema.safeParse(id).success) throw Errors.notFound();
  const m = await prisma.brandMaterial.findFirst({ where: { id, workspaceId: scope.workspaceId, deletedAt: null }, select });
  if (!m) throw Errors.notFound();
  return m;
}

async function drawingContext(business) {
  const [brand, details] = await Promise.all([resolveBrand(business.id, business), loadDetails(business.id)]);
  return { brand, details: presentDetails(details, business) };
}

/** Renders every view of a spec (print files + mockups). */
async function render(kind, spec, business) {
  const { brand, details } = await drawingContext(business);
  const { views } = await renderMaterial({ kind, spec, brand, details });
  return { views, brandApproved: brand.approved, detailsSaved: details.saved };
}

/**
 * Three options for a kind. Stationery (cards, letterheads) uses the three
 * templates with the business details; merch, labels and packaging ask the AI
 * for concepts and copy (normalized to valid keys in code).
 */
export async function generateMaterialOptions(user, workspaceId, input, request) {
  const kind = MATERIAL_KINDS[input.kind];
  const scope = await requireWorkspaceAccess(user, workspaceId, kind.ai ? PERMISSIONS.AI_GENERATE : PERMISSIONS.BUSINESS_UPDATE);
  const business = await findScopedBusiness(scope, input.businessId);
  const details = await loadDetails(business.id);
  const person = { name: user.name ?? "", title: "", phone: details?.phone ?? "", email: user.email ?? "", ...(input.person ?? {}) };
  const base = blankSpec(input.kind, { person, tagline: "" });

  let specs;
  let isMock = false;
  if (kind.ai) {
    const products = await prisma.businessProduct.findMany({ where: { businessId: business.id }, orderBy: { sortOrder: "asc" }, take: 12 });
    const result = await generateText({
      user, workspaceId, businessId: business.id, module: "stationery", task: "materials",
      instructions: materialInstructions(input.kind),
      input: materialInput({ business, brief: input.brief, products }),
      schema: aiMaterialOptionsSchema, effort: "low", maxTokens: 3000, request,
    });
    specs = result.data.options.slice(0, 3).map((o) => normalizeMaterialSpec(input.kind, o, base));
    isMock = result.isMock;
    if (!specs.length) throw Errors.validation({ brief: ["The AI returned no options. Try again."] });
  } else {
    specs = templateOptions(input.kind, base);
  }
  const rendered = await Promise.all(specs.map((spec) => render(input.kind, spec, business)));
  return {
    options: specs.map((spec, i) => ({ spec, views: rendered[i].views })),
    brandApproved: rendered[0].brandApproved,
    detailsSaved: rendered[0].detailsSaved,
    isMock,
  };
}

export async function previewMaterial(user, workspaceId, { businessId, kind, spec }) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const business = await findScopedBusiness(scope, businessId);
  return render(kind, normalizeMaterialSpec(kind, spec, spec), business);
}

export async function listMaterials(user, workspaceId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  return prisma.brandMaterial.findMany({ where: { workspaceId: scope.workspaceId, deletedAt: null }, orderBy: { updatedAt: "desc" }, select, take: 300 });
}

export async function getMaterial(user, workspaceId, id) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const m = await findMaterial(scope, id);
  const revisions = await prisma.brandMaterialRevision.findMany({ where: { materialId: m.id }, orderBy: { version: "desc" }, select: { version: true, createdAt: true } });
  return { ...m, revisions, permissions: { canEdit: scope.can(PERMISSIONS.BUSINESS_UPDATE) } };
}

export async function saveMaterial(user, workspaceId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const business = await findScopedBusiness(scope, input.businessId);
  const spec = materialSpecSchema.parse(normalizeMaterialSpec(input.kind, input.spec, input.spec));
  const created = await prisma.$transaction(async (tx) => {
    const m = await tx.brandMaterial.create({ data: { workspaceId: scope.workspaceId, businessId: business.id, kind: input.kind, name: spec.name, spec, isMock: input.isMock, createdById: user.id }, select: { id: true } });
    await tx.brandMaterialRevision.create({ data: { materialId: m.id, version: 1, spec, createdById: user.id } });
    return m;
  });
  await recordAudit({ action: "material.created", actorId: user.id, workspaceId, entityType: "brand_material", entityId: created.id, metadata: { kind: input.kind }, request });
  return getMaterial(user, workspaceId, created.id);
}

/** Saving creates a new version; earlier versions can be restored. */
export async function updateMaterial(user, workspaceId, id, { spec: raw }, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const m = await findMaterial(scope, id);
  const spec = materialSpecSchema.parse(normalizeMaterialSpec(m.kind, raw, raw));
  await prisma.$transaction(async (tx) => {
    await tx.brandMaterial.update({ where: { id: m.id }, data: { spec, name: spec.name, version: m.version + 1 } });
    await tx.brandMaterialRevision.create({ data: { materialId: m.id, version: m.version + 1, spec, createdById: user.id } });
  });
  await recordAudit({ action: "material.updated", actorId: user.id, workspaceId, entityType: "brand_material", entityId: m.id, request });
  return getMaterial(user, workspaceId, m.id);
}

export async function restoreMaterialRevision(user, workspaceId, id, version, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const m = await findMaterial(scope, id);
  const rev = await prisma.brandMaterialRevision.findFirst({ where: { materialId: m.id, version } });
  if (!rev) throw Errors.notFound();
  return updateMaterial(user, workspaceId, m.id, { spec: rev.spec }, request);
}

export async function duplicateMaterial(user, workspaceId, id, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const m = await findMaterial(scope, id);
  return saveMaterial(user, workspaceId, { businessId: m.businessId, kind: m.kind, spec: { ...m.spec, name: `${m.spec.name} (copy)`.slice(0, 80) }, isMock: m.isMock }, request);
}

export async function deleteMaterial(user, workspaceId, id, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const m = await findMaterial(scope, id);
  await prisma.brandMaterial.update({ where: { id: m.id }, data: { deletedAt: new Date() } });
  await recordAudit({ action: "material.deleted", actorId: user.id, workspaceId, entityType: "brand_material", entityId: m.id, request });
}

/** One view of a saved material as SVG (for thumbnails and downloads). */
export async function renderMaterialView(user, workspaceId, id, viewKey) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const m = await findMaterial(scope, id);
  const { views } = await render(m.kind, m.spec, m.business);
  const view = viewKey ? views.find((v) => v.key === viewKey) : views[0];
  if (!view) throw Errors.notFound();
  return { view, material: m };
}
