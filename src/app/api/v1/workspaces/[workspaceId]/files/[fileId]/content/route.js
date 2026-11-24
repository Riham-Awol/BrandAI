import { route } from "@/server/http/route-handler.js";
import { readFile } from "@/server/storage/files-service.js";

/**
 * Serves a stored file to members of its workspace. S3 → redirect to a
 * short-lived signed URL; database storage → streamed bytes.
 * Only magic-byte-validated types (PNG/JPEG/GIF/WebP/PDF) are ever stored.
 */
export const GET = route({}, async ({ user, params, request }) => {
  const { file, url, body } = await readFile(user, params.workspaceId, params.fileId);
  if (url) return Response.redirect(url, 302);
  const download = new URL(request.url).searchParams.get("download") === "1";
  const safeName = file.originalName.replace(/["\\\r\n]/g, "");
  return new Response(body, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(body.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName}"`,
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, max-age=300",
    },
  });
});
