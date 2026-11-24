import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { regenerateSection } from "@/modules/website/service.js";
import { regenerateSectionSchema } from "@/modules/website/schemas.js";

export const maxDuration = 300;

/** Rewrites one section with AI (saved into the draft). */
export const POST = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(regenerateSectionSchema, await json());
  return ok(await regenerateSection(user, params.workspaceId, params.websiteId, input, requestInfo));
});
