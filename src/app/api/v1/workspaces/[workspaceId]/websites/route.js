import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { createWebsite, listWebsites } from "@/modules/website/service.js";
import { createWebsiteSchema } from "@/modules/website/schemas.js";

export const maxDuration = 300;

export const GET = route({}, async ({ user, params }) => ok(await listWebsites(user, params.workspaceId)));

/** Creates a website — written by AI (`generate: true`) or from the starter template. */
export const POST = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(createWebsiteSchema, await json());
  return ok(await createWebsite(user, params.workspaceId, input, requestInfo), { status: 201 });
});
