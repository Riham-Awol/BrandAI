import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { Errors } from "@/server/errors.js";
import { recordAudit } from "@/server/audit/service.js";
import { generateText } from "@/server/ai/orchestrator.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { findScopedBusiness } from "@/server/businesses/service.js";
import { findBusinessImage, listBusinessImages, readBusinessImage } from "@/server/storage/business-images.js";
import { resolveBrand } from "@/server/brand/approved-brand.js";
import { renderDesignSvg } from "@/server/design/renderer.js";
import { uuidSchema } from "@/validation/common.js";
import { DESIGN_FORMATS, DESIGN_KINDS, POST_FORMAT_TO_DESIGN } from "./catalog.js";
import { diversifyTemplates, ensurePhotoLayout, normalizeSpec } from "./spec-utils.js";
import { designOptionsSchema, designSpecSchema } from "./schemas.js";
import { designInput, designInstructions } from "./prompts.js";
import "./mock-fixtures.js";

const designSelect = {
  id: true, businessId: true, kind: true, format: true, name: true, brief: true, spec: true, imageFileId: true,
  sourcePostId: true, version: true, isMock: true, createdAt: true, updatedAt: true,
  business: { select: { id: true, name: true } },
};

function assertFormat(kind, format) {
  if (!DESIGN_KINDS[kind].formats.includes(format)) throw Errors.validation({ format: [`This size is not available for a ${DESIGN_KINDS[kind].label.toLowerCase()}.`] });
}

/** Loads a business image (uploaded brand asset) as a data URI; rejects other businesses/workspaces. */
async function loadImage(scope, businessId, fileId) {
  if (!fileId) return null;
  const file = await findBusinessImage(scope.workspaceId, businessId, fileId);
  const { body, mime } = await readBusinessImage(file);
  return `data:${mime};base64,${body.toString("base64")}`;
}

async function findDesign(scope, designId) {
  if (!uuidSchema.safeParse(designId).success) throw Errors.notFound();
  const design = await prisma.design.findFirst({ where: { id: designId, workspaceId: scope.workspaceId, deletedAt: null }, select: designSelect });
  if (!design) throw Errors.notFound();
  return design;
}

async function findSourcePost(scope, businessId, postId) {
  if (!postId) return null;
  if (!uuidSchema.safeParse(postId).success) throw Errors.notFound();
  const post = await prisma.socialPost.findFirst({
    where: { id: postId, workspaceId: scope.workspaceId, deletedAt: null, ...(businessId ? { businessId } : {}) },
    select: { id: true, businessId: true, platform: true, format: true, title: true, isPromotion: true, content: true, scheduledDate: true, projectId: true },
  });
  if (!post) throw Errors.notFound();
  return post;
}

/** Images a design can use: the business's uploaded image assets. */
export async function listDesignImages(user, workspaceId, businessId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  await findScopedBusiness(scope, businessId);
  return listBusinessImages(scope, businessId);
}

/** Pre-fill for "Design this post" (Phase 4 → Phase 5). */
export async function getPostPrefill(user, workspaceId, postId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const post = await findSourcePost(scope, null, postId);
  const c = post.content;
  const brief = [post.title, c?.hook, c?.visualIdea && `Visual: ${c.visualIdea}`].filter(Boolean).join("\n");
  const details = c?.promotion?.offer ? [c.promotion.offer, c.promotion.validUntil && `Valid until ${c.promotion.validUntil}`, c.promotion.code && `Code ${c.promotion.code}`].filter(Boolean).join("\n") : "";
  return { postId: post.id, businessId: post.businessId, kind: "SOCIAL", format: POST_FORMAT_TO_DESIGN[post.format] ?? "square", brief: brief.slice(0, 2000), details: details.slice(0, 1000), cta: (c?.callToAction ?? "").slice(0, 120), title: post.title };
}

/** Three AI design options for a brief, each rendered to SVG for preview. Nothing is saved. */
export async function generateDesignOptions(user, workspaceId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.AI_GENERATE);
  const business = await findScopedBusiness(scope, input.businessId);
  assertFormat(input.kind, input.format);
  const image = await loadImage(scope, business.id, input.imageFileId);
  const post = await findSourcePost(scope, business.id, input.sourcePostId);

  const result = await generateText({
    user, workspaceId, businessId: business.id, module: "design", task: "options",
    instructions: designInstructions({ kind: input.kind, format: input.format, hasImage: Boolean(image) }),
    input: designInput({ business, brief: input, sourcePost: post ? { title: post.title, ...post.content } : null }),
    schema: designOptionsSchema, effort: "medium", maxTokens: 5000, request,
  });
  const options = diversifyTemplates(ensurePhotoLayout(result.data.options.slice(0, 3).map(normalizeSpec), Boolean(image)));
  if (!options.length) throw Errors.validation({ brief: ["The AI returned no designs. Try again with more detail."] });

  const brand = await resolveBrand(business.id, business);
  const rendered = await Promise.all(options.map((spec) => renderDesignSvg({ spec, format: input.format, brand, image })));
  return {
    options: options.map((spec, i) => ({ spec, svg: rendered[i].svg, warnings: rendered[i].warnings })),
    brandApproved: brand.approved,
    isMock: result.isMock,
    generationId: result.generationId,
  };
}

export async function previewDesign(user, workspaceId, input) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const business = await findScopedBusiness(scope, input.businessId);
  const image = await loadImage(scope, business.id, input.imageFileId);
  const brand = await resolveBrand(business.id, business);
  const { svg, warnings } = await renderDesignSvg({ spec: input.spec, format: input.format, brand, image });
  return { svg, warnings, brandApproved: brand.approved };
}

export async function listDesigns(user, workspaceId, { businessId } = {}) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  return prisma.design.findMany({
    where: { workspaceId: scope.workspaceId, deletedAt: null, ...(businessId && uuidSchema.safeParse(businessId).success ? { businessId } : {}) },
    orderBy: { updatedAt: "desc" },
    select: designSelect,
    take: 200,
  });
}

export async function getDesign(user, workspaceId, designId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const design = await findDesign(scope, designId);
  const revisions = await prisma.designRevision.findMany({ where: { designId: design.id }, orderBy: { version: "desc" }, select: { id: true, version: true, format: true, createdAt: true } });
  return { ...design, revisions, permissions: { canEdit: scope.can(PERMISSIONS.BUSINESS_UPDATE) } };
}

export async function saveDesign(user, workspaceId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const business = await findScopedBusiness(scope, input.businessId);
  assertFormat(input.kind, input.format);
  if (input.imageFileId) await loadImage(scope, business.id, input.imageFileId);
  if (input.sourcePostId) await findSourcePost(scope, business.id, input.sourcePostId);
  const spec = normalizeSpec(designSpecSchema.parse(input.spec));
  const design = await prisma.$transaction(async (tx) => {
    const created = await tx.design.create({
      data: {
        workspaceId: scope.workspaceId, businessId: business.id, kind: input.kind, format: input.format, name: spec.name.slice(0, 160),
        brief: input.brief, spec, imageFileId: input.imageFileId ?? null, sourcePostId: input.sourcePostId ?? null, isMock: input.isMock, createdById: user.id,
      },
      select: { id: true },
    });
    await tx.designRevision.create({ data: { designId: created.id, version: 1, format: input.format, spec, imageFileId: input.imageFileId ?? null, createdById: user.id } });
    return created;
  });
  await recordAudit({ action: "design.created", actorId: user.id, workspaceId, entityType: "design", entityId: design.id, metadata: { kind: input.kind, format: input.format }, request });
  return getDesign(user, workspaceId, design.id);
}

/** Edits create a new revision; earlier revisions stay available. */
export async function updateDesign(user, workspaceId, designId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const design = await findDesign(scope, designId);
  const format = input.format ?? design.format;
  assertFormat(design.kind, format);
  const imageFileId = input.imageFileId === undefined ? design.imageFileId : input.imageFileId;
  if (input.imageFileId) await loadImage(scope, design.businessId, input.imageFileId);
  const spec = input.spec ? normalizeSpec(input.spec) : design.spec;
  const name = input.name ?? (input.spec ? spec.name : design.name);
  const visualChange = Boolean(input.spec) || format !== design.format || imageFileId !== design.imageFileId;
  await prisma.$transaction(async (tx) => {
    const version = visualChange ? design.version + 1 : design.version;
    await tx.design.update({ where: { id: design.id }, data: { name: name.slice(0, 160), format, spec, imageFileId, version } });
    if (visualChange) await tx.designRevision.create({ data: { designId: design.id, version, format, spec, imageFileId, createdById: user.id } });
  });
  await recordAudit({ action: "design.updated", actorId: user.id, workspaceId, entityType: "design", entityId: design.id, request });
  return getDesign(user, workspaceId, design.id);
}

export async function restoreRevision(user, workspaceId, designId, version, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const design = await findDesign(scope, designId);
  const rev = await prisma.designRevision.findFirst({ where: { designId: design.id, version } });
  if (!rev) throw Errors.notFound();
  return updateDesign(user, workspaceId, design.id, { spec: rev.spec, format: rev.format, imageFileId: rev.imageFileId }, request);
}

export async function duplicateDesign(user, workspaceId, designId, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const d = await findDesign(scope, designId);
  return saveDesign(user, workspaceId, { businessId: d.businessId, kind: d.kind, format: d.format, brief: d.brief, spec: { ...d.spec, name: `${d.spec.name} (copy)`.slice(0, 80) }, imageFileId: d.imageFileId, sourcePostId: d.sourcePostId, isMock: d.isMock }, request);
}

export async function deleteDesign(user, workspaceId, designId, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const design = await findDesign(scope, designId);
  await prisma.design.update({ where: { id: design.id }, data: { deletedAt: new Date() } });
  await recordAudit({ action: "design.deleted", actorId: user.id, workspaceId, entityType: "design", entityId: design.id, request });
}

/** Renders a saved design (current version or a given format override for resizing). */
export async function renderDesign(user, workspaceId, designId, { format } = {}) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const design = await findDesign(scope, designId);
  const target = format && DESIGN_FORMATS[format] ? format : design.format;
  const brand = await resolveBrand(design.businessId, design.business);
  let image = null;
  try {
    image = await loadImage(scope, design.businessId, design.imageFileId);
  } catch {
    image = null; // image deleted since: render with the placeholder panel
  }
  const rendered = await renderDesignSvg({ spec: designSpecSchema.parse(design.spec), format: target, brand, image });
  return { ...rendered, design };
}
