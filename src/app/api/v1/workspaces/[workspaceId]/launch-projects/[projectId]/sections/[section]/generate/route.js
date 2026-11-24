import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { generateSection } from "@/modules/launch/service.js";
import { generateSectionSchema } from "@/modules/launch/schemas.js";

// AI generation can take up to a couple of minutes for long sections.
export const maxDuration = 300;

export const POST = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(generateSectionSchema, await json());
  return ok(await generateSection(user, params.workspaceId, params.projectId, params.section, input, requestInfo), { status: 201 });
});
