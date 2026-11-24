import { route } from "@/server/http/route-handler.js";
import { exportLaunchPack } from "@/modules/launch/service.js";

/** Downloads the launch pack as Markdown. */
export const GET = route({}, async ({ user, params }) => {
  const { filename, markdown } = await exportLaunchPack(user, params.workspaceId, params.projectId);
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
