import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/prisma.js";
import { Errors } from "../errors.js";
import { recordAudit, AUDIT_ACTIONS } from "../audit/service.js";
import { requireWorkspaceAccess } from "../permissions/authorize.js";
import { PERMISSIONS } from "../permissions/roles.js";
import { assertWithinLimits } from "../usage/service.js";
import { findScopedBusiness } from "../businesses/service.js";
import { getStorage } from "./index.js";
import { sanitizeFileName, validateUpload } from "./file-validation.js";

const fileSelect = { id: true, businessId: true, originalName: true, mimeType: true, sizeBytes: true, purpose: true, createdAt: true };

/** Validates, stores and records an uploaded file for a workspace. */
export async function uploadFile(user, workspaceId, { buffer, originalName, purpose, businessId }, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.FILES_UPLOAD);
  if (businessId) await findScopedBusiness(scope, businessId);

  const check = validateUpload(buffer);
  if (!check.ok) throw Errors.validation({ file: [check.reason] }, check.reason);
  await assertWithinLimits(scope.workspaceId, ["STORAGE_BYTES"], { additional: { STORAGE_BYTES: buffer.length } });

  const storage = getStorage();
  const objectKey = `workspaces/${scope.workspaceId}/${purpose}/${randomUUID()}.${check.ext}`;
  await storage.put(objectKey, buffer, { contentType: check.mimeType });

  const file = await prisma.storedFile.create({
    data: {
      workspaceId: scope.workspaceId,
      businessId: businessId ?? null,
      uploadedById: user.id,
      provider: storage.name,
      bucket: storage.bucket,
      objectKey,
      originalName: sanitizeFileName(originalName),
      mimeType: check.mimeType,
      sizeBytes: buffer.length,
      checksum: check.checksum,
      purpose,
    },
    select: fileSelect,
  });
  await recordAudit({ action: AUDIT_ACTIONS.FILE_UPLOADED, actorId: user.id, workspaceId, entityType: "stored_file", entityId: file.id, request });
  return file;
}

export async function getFileDownloadUrl(user, workspaceId, fileId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.WORKSPACE_READ);
  const file = await prisma.storedFile.findFirst({ where: { id: fileId, workspaceId: scope.workspaceId, deletedAt: null } });
  if (!file) throw Errors.notFound();
  return getStorage().signedUrl(file.objectKey, { downloadName: file.originalName });
}

export async function deleteFile(user, workspaceId, fileId, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.FILES_DELETE);
  const file = await prisma.storedFile.findFirst({ where: { id: fileId, workspaceId: scope.workspaceId, deletedAt: null } });
  if (!file) throw Errors.notFound();
  await prisma.storedFile.update({ where: { id: file.id }, data: { deletedAt: new Date() } });
  await getStorage().delete(file.objectKey);
  await recordAudit({ action: AUDIT_ACTIONS.FILE_DELETED, actorId: user.id, workspaceId, entityType: "stored_file", entityId: file.id, request });
}
