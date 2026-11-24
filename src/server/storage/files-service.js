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
import { uuidSchema } from "@/validation/common.js";

const fileSelect = { id: true, businessId: true, originalName: true, mimeType: true, sizeBytes: true, purpose: true, createdAt: true };

/** Validates, stores and records an uploaded file for a workspace. */
export async function uploadFile(user, workspaceId, { buffer, originalName, purpose, businessId }, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.FILES_UPLOAD);
  if (businessId) await findScopedBusiness(scope, businessId);

  const storage = getStorage();
  const check = validateUpload(buffer, storage.maxFileBytes ? { maxBytes: storage.maxFileBytes } : undefined);
  if (!check.ok) throw Errors.validation({ file: [check.reason] }, check.reason);
  await assertWithinLimits(scope.workspaceId, ["STORAGE_BYTES"], { additional: { STORAGE_BYTES: buffer.length } });

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
  const file = await findScopedFile(scope, fileId);
  return getStorage().signedUrl(file.objectKey, { downloadName: file.originalName });
}

async function findScopedFile(scope, fileId) {
  if (!uuidSchema.safeParse(fileId).success) throw Errors.notFound();
  const file = await prisma.storedFile.findFirst({ where: { id: fileId, workspaceId: scope.workspaceId, deletedAt: null } });
  if (!file) throw Errors.notFound();
  return file;
}

/**
 * Returns either a short-lived external URL (S3) or the bytes (database /
 * memory storage) for an authorized member of the file's workspace.
 */
export async function readFile(user, workspaceId, fileId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.WORKSPACE_READ);
  const file = await findScopedFile(scope, fileId);
  const storage = getStorage();
  const url = await storage.signedUrl(file.objectKey, { downloadName: file.originalName });
  if (url) return { file, url };
  const object = await storage.get(file.objectKey);
  if (!object) throw Errors.notFound();
  return { file, body: object.body };
}

export async function deleteFile(user, workspaceId, fileId, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.FILES_DELETE);
  const file = await findScopedFile(scope, fileId);
  await prisma.storedFile.update({ where: { id: file.id }, data: { deletedAt: new Date() } });
  await getStorage().delete(file.objectKey);
  await recordAudit({ action: AUDIT_ACTIONS.FILE_DELETED, actorId: user.id, workspaceId, entityType: "stored_file", entityId: file.id, request });
}
