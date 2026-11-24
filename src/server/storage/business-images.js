import "server-only";
import { prisma } from "../db/prisma.js";
import { Errors } from "../errors.js";
import { uuidSchema } from "@/validation/common.js";
import { getStorage } from "./index.js";
import { detectMimeType } from "./file-validation.js";

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Image brand assets of a business (caller has already authorized the scope + business). */
export async function listBusinessImages(scope, businessId) {
  const assets = await prisma.brandAsset.findMany({
    where: { workspaceId: scope.workspaceId, businessId, deletedAt: null, storedFile: { mimeType: { in: IMAGE_TYPES }, deletedAt: null } },
    orderBy: { createdAt: "desc" },
    select: { name: true, storedFile: { select: { id: true } } },
  });
  return assets.map((a) => ({ fileId: a.storedFile.id, name: a.name }));
}

/** The stored-file row for an image of exactly this workspace + business, or a validation error. */
export async function findBusinessImage(workspaceId, businessId, fileId, field = "imageFileId") {
  if (!uuidSchema.safeParse(fileId).success) throw Errors.notFound();
  const file = await prisma.storedFile.findFirst({ where: { id: fileId, workspaceId, businessId, deletedAt: null } });
  if (!file) throw Errors.validation({ [field]: ["Choose an image from this business's brand assets."] });
  if (!IMAGE_TYPES.includes(file.mimeType) || file.sizeBytes > MAX_IMAGE_BYTES) throw Errors.validation({ [field]: ["Use a PNG, JPEG, GIF or WebP image up to 5 MB."] });
  return file;
}

/** Bytes of a validated image (magic bytes re-checked), or `{ url }` for external storage. */
export async function readBusinessImage(file, { preferUrl = false } = {}) {
  const storage = getStorage();
  if (preferUrl) {
    const url = await storage.signedUrl(file.objectKey, { downloadName: file.originalName });
    if (url) return { url };
  }
  const object = await storage.get(file.objectKey);
  if (!object) throw Errors.notFound();
  const body = Buffer.from(object.body);
  const mime = detectMimeType(body);
  if (!IMAGE_TYPES.includes(mime)) throw Errors.validation({ imageFileId: ["The stored file is not a supported image."] });
  return { body, mime };
}
