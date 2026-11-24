import { Errors } from "@/server/errors.js";
import { route } from "@/server/http/route-handler.js";
import { exportPosts } from "@/modules/social/posts-service.js";

/** ?format=csv|markdown */
export const GET = route({}, async ({ user, params, request }) => {
  const format = new URL(request.url).searchParams.get("format") ?? "csv";
  if (!["csv", "markdown"].includes(format)) throw Errors.validation({ format: ["Use csv or markdown."] });
  const { filename, contentType, body } = await exportPosts(user, params.workspaceId, params.projectId, format);
  return new Response(body, { headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
});
