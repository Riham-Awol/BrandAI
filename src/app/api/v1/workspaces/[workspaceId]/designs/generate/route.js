import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { generateDesignOptions } from "@/modules/design/service.js";
import { designBriefSchema } from "@/modules/design/schemas.js";

export const maxDuration = 300;

/** Three AI design options for a brief (rendered previews; nothing is saved). */
export const POST = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(designBriefSchema, await json());
  return ok(await generateDesignOptions(user, params.workspaceId, input, requestInfo));
});
