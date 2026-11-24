import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { getWorkspace } from "@/server/workspaces/service.js";

export const GET = route({}, async ({ user, params }) => ok(await getWorkspace(user, params.workspaceId)));
