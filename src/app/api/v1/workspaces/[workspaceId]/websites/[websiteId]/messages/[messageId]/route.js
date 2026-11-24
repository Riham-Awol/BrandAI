import { z } from "zod";
import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { deleteSubmission, updateSubmission } from "@/modules/website/service.js";

const schema = z.object({ read: z.boolean() });

export const PATCH = route({}, async ({ user, params, json }) => {
  await updateSubmission(user, params.workspaceId, params.websiteId, params.messageId, parseWith(schema, await json()));
  return ok({ updated: true });
});

export const DELETE = route({}, async ({ user, params, requestInfo }) => {
  await deleteSubmission(user, params.workspaceId, params.websiteId, params.messageId, requestInfo);
  return ok({ deleted: true });
});
