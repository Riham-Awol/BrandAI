import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { listSubmissions } from "@/modules/website/service.js";

/** Contact and order messages sent from the published site. */
export const GET = route({}, async ({ user, params }) => ok(await listSubmissions(user, params.workspaceId, params.websiteId)));
