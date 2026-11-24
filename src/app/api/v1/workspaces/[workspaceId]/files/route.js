import { z } from "zod";
import { Errors } from "@/server/errors.js";
import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { MAX_UPLOAD_BYTES } from "@/server/storage/file-validation.js";
import { uploadFile } from "@/server/storage/files-service.js";

const metaSchema = z.object({
  purpose: z.enum(["brand-asset", "business-document", "design-source"]),
  businessId: z.uuid().optional(),
});

/** multipart/form-data upload: fields `file`, `purpose`, optional `businessId`. */
export const POST = route({}, async ({ user, params, request, requestInfo }) => {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) throw Errors.validation({ file: ["The file is too large."] });
  const form = await request.formData().catch(() => {
    throw Errors.validation({ _: ["Expected multipart/form-data."] });
  });
  const file = form.get("file");
  if (!file || typeof file === "string") throw Errors.validation({ file: ["Attach a file."] });
  const meta = parseWith(metaSchema, { purpose: form.get("purpose"), businessId: form.get("businessId") || undefined });
  const buffer = Buffer.from(await file.arrayBuffer());
  return ok(await uploadFile(user, params.workspaceId, { buffer, originalName: file.name, ...meta }, requestInfo), { status: 201 });
});
