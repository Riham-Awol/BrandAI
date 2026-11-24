import { Errors } from "@/server/errors.js";
import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { MAX_UPLOAD_BYTES } from "@/server/storage/file-validation.js";
import { assetMetaSchema, listBrandAssets, uploadBrandAsset } from "@/modules/brand/assets-service.js";

export const GET = route({}, async ({ user, params }) => ok(await listBrandAssets(user, params.workspaceId, params.businessId)));

/** multipart/form-data: file, name, kind, description? */
export const POST = route({}, async ({ user, params, request, requestInfo }) => {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) throw Errors.validation({ file: ["The file is too large."] });
  const form = await request.formData().catch(() => {
    throw Errors.validation({ _: ["Expected multipart/form-data."] });
  });
  const file = form.get("file");
  if (!file || typeof file === "string") throw Errors.validation({ file: ["Attach a file."] });
  const meta = parseWith(assetMetaSchema, { name: form.get("name") || file.name, kind: form.get("kind") || undefined, description: form.get("description") || undefined });
  const buffer = Buffer.from(await file.arrayBuffer());
  return ok(await uploadBrandAsset(user, params.workspaceId, params.businessId, { buffer, originalName: file.name, meta }, requestInfo), { status: 201 });
});
