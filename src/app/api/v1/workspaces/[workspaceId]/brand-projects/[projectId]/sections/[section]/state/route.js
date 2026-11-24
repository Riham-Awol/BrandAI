import { z } from "zod";
import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { brandEngine } from "@/modules/brand/service.js";

const bodySchema = z.object({ outputId: z.uuid(), state: z.record(z.string(), z.unknown()) });

/** Saves the user's choice (e.g. selected palette) on a specific version. */
export const PATCH = route({}, async ({ user, params, json }) => {
  const { outputId, state } = parseWith(bodySchema, await json());
  return ok(await brandEngine.updateSectionState(user, params.workspaceId, params.projectId, params.section, outputId, state));
});
