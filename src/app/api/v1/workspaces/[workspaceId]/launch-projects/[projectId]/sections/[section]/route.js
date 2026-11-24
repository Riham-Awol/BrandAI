import { z } from "zod";
import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { editSection } from "@/modules/launch/service.js";

const bodySchema = z.object({ content: z.record(z.string(), z.unknown()) });

/** Saves a user edit as a new version (validated against the section schema). */
export const PUT = route({}, async ({ user, params, json, requestInfo }) => {
  const { content } = parseWith(bodySchema, await json());
  return ok(await editSection(user, params.workspaceId, params.projectId, params.section, content, requestInfo), { status: 201 });
});
