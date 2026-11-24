import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { previewDesign } from "@/modules/design/service.js";
import { previewSchema } from "@/modules/design/schemas.js";

/** Live preview of an unsaved spec, rendered with the business's approved brand. */
export const POST = route({}, async ({ user, params, json }) => {
  const input = parseWith(previewSchema, await json());
  return ok(await previewDesign(user, params.workspaceId, input));
});
