import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { brandEngine } from "@/modules/brand/service.js";
import { generateSectionSchema } from "@/modules/launch/schemas.js";

export const maxDuration = 300;

export const POST = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(generateSectionSchema, await json());
  return ok(await brandEngine.generateSection(user, params.workspaceId, params.projectId, params.section, input, requestInfo), { status: 201 });
});
