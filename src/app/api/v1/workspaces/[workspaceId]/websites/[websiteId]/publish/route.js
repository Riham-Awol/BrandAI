import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { listWebsiteVersions, publishWebsite } from "@/modules/website/service.js";

export const GET = route({}, async ({ user, params }) => ok(await listWebsiteVersions(user, params.workspaceId, params.websiteId)));

/** Publishes the current draft as a new version (owner/admin: `website:publish`). */
export const POST = route({}, async ({ user, params, requestInfo }) => ok(await publishWebsite(user, params.workspaceId, params.websiteId, requestInfo)));
