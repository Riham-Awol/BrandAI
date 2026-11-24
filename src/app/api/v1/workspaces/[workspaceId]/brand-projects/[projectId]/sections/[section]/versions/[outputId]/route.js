import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { brandEngine } from "@/modules/brand/service.js";

export const GET = route({}, async ({ user, params }) =>
  ok(await brandEngine.getSectionVersion(user, params.workspaceId, params.projectId, params.section, params.outputId)),
);
