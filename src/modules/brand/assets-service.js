import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db/prisma.js";
import { Errors } from "@/server/errors.js";
import { recordAudit } from "@/server/audit/service.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { findScopedBusiness } from "@/server/businesses/service.js";
import { deleteFile, uploadFile } from "@/server/storage/files-service.js";
import { uuidSchema } from "@/validation/common.js";

export const assetMetaSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(160),
  kind: z.enum(["LOGO", "ICON", "IMAGE", "DOCUMENT", "OTHER"]).default("OTHER"),
  description: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

const assetSelect = {
  id: true, name: true, kind: true, description: true, createdAt: true,
  storedFile: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } },
};

export async function listBrandAssets(user, workspaceId, businessId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  await findScopedBusiness(scope, businessId);
  return prisma.brandAsset.findMany({ where: { businessId, workspaceId: scope.workspaceId, deletedAt: null }, orderBy: { createdAt: "desc" }, select: assetSelect });
}

export async function uploadBrandAsset(user, workspaceId, businessId, { buffer, originalName, meta }, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.FILES_UPLOAD);
  await findScopedBusiness(scope, businessId);
  const file = await uploadFile(user, workspaceId, { buffer, originalName, purpose: "brand-asset", businessId }, request);
  return prisma.brandAsset.create({
    data: { workspaceId: scope.workspaceId, businessId, storedFileId: file.id, name: meta.name, kind: meta.kind, description: meta.description, createdById: user.id },
    select: assetSelect,
  });
}

export async function deleteBrandAsset(user, workspaceId, businessId, assetId, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.FILES_DELETE);
  await findScopedBusiness(scope, businessId);
  if (!uuidSchema.safeParse(assetId).success) throw Errors.notFound();
  const asset = await prisma.brandAsset.findFirst({ where: { id: assetId, businessId, workspaceId: scope.workspaceId, deletedAt: null } });
  if (!asset) throw Errors.notFound();
  await prisma.brandAsset.update({ where: { id: asset.id }, data: { deletedAt: new Date() } });
  await deleteFile(user, workspaceId, asset.storedFileId, request);
  await recordAudit({ action: "brand.asset_deleted", actorId: user.id, workspaceId, entityType: "brand_asset", entityId: asset.id, request });
}
