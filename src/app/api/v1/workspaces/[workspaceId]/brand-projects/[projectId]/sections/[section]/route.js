import { z } from "zod";
import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { brandEngine } from "@/modules/brand/service.js";

const bodySchema = z.object({ content: z.record(z.string(), z.unknown()), state: z.record(z.string(), z.unknown()).optional() });

export const PUT = route({}, async ({ user, params, json, requestInfo }) => {
  const { content, state } = parseWith(bodySchema, await json());
  return ok(await brandEngine.editSection(user, params.workspaceId, params.projectId, params.section, content, requestInfo, { state }), { status: 201 });
});
