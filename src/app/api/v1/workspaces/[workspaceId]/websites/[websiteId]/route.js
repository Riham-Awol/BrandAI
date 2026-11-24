import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { deleteWebsite, getWebsite, updateWebsite } from "@/modules/website/service.js";
import { updateWebsiteSchema } from "@/modules/website/schemas.js";

export const GET = route({}, async ({ user, params }) => ok(await getWebsite(user, params.workspaceId, params.websiteId)));

/** Saves the draft (`config`), name or address (`slug`). 409 if `baseRevision` is stale. */
export const PATCH = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(updateWebsiteSchema, await json());
  return ok(await updateWebsite(user, params.workspaceId, params.websiteId, input, requestInfo));
});

export const DELETE = route({}, async ({ user, params, requestInfo }) => {
  await deleteWebsite(user, params.workspaceId, params.websiteId, requestInfo);
  return ok({ deleted: true });
});
