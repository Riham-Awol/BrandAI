import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { unpublishWebsite } from "@/modules/website/service.js";

export const POST = route({}, async ({ user, params, requestInfo }) => ok(await unpublishWebsite(user, params.workspaceId, params.websiteId, requestInfo)));
