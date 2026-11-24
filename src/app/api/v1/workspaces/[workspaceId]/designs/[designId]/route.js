import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { deleteDesign, getDesign, updateDesign } from "@/modules/design/service.js";
import { updateDesignSchema } from "@/modules/design/schemas.js";

export const GET = route({}, async ({ user, params }) => ok(await getDesign(user, params.workspaceId, params.designId)));

/** Edits create a new revision. */
export const PATCH = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(updateDesignSchema, await json());
  return ok(await updateDesign(user, params.workspaceId, params.designId, input, requestInfo));
});

export const DELETE = route({}, async ({ user, params, requestInfo }) => {
  await deleteDesign(user, params.workspaceId, params.designId, requestInfo);
  return ok({ deleted: true });
});
