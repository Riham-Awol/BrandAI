import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { listMembers } from "@/server/workspaces/team-service.js";

export const GET = route({}, async ({ user, params }) => ok(await listMembers(user, params.workspaceId)));
