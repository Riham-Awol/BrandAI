import { z } from "zod";
import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { Errors } from "@/server/errors.js";
import { restoreVersionToDraft } from "@/modules/website/service.js";

/** Copies a published version into the draft. */
export const POST = route({}, async ({ user, params, requestInfo }) => {
  const parsed = z.coerce.number().int().min(1).max(100000).safeParse(params.version);
  if (!parsed.success) throw Errors.notFound();
  return ok(await restoreVersionToDraft(user, params.workspaceId, params.websiteId, parsed.data, requestInfo));
});
