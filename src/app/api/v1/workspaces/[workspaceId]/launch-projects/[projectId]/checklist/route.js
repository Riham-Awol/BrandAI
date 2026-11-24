import { z } from "zod";
import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { updateChecklistProgress } from "@/modules/launch/service.js";
import { checklistStateSchema } from "@/modules/launch/schemas.js";

const bodySchema = checklistStateSchema.extend({ outputId: z.uuid() });

export const PATCH = route({}, async ({ user, params, json }) => {
  const { outputId, completed } = parseWith(bodySchema, await json());
  return ok(await updateChecklistProgress(user, params.workspaceId, params.projectId, outputId, completed));
});
