import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { getProfileDraftForProject } from "@/modules/launch/profile-draft.js";

export const GET = route({}, async ({ user, params }) => ok(await getProfileDraftForProject(user, params.workspaceId, params.projectId)));
