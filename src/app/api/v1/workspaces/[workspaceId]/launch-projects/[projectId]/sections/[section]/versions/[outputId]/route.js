import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { getSectionVersion } from "@/modules/launch/service.js";

export const GET = route({}, async ({ user, params }) =>
  ok(await getSectionVersion(user, params.workspaceId, params.projectId, params.section, params.outputId)),
);
