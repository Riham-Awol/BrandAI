import { z } from "zod";
import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { Errors } from "@/server/errors.js";
import { restoreRevision } from "@/modules/design/service.js";

/** Restores an earlier revision as a new version. */
export const POST = route({}, async ({ user, params, requestInfo }) => {
  const parsed = z.coerce.number().int().min(1).max(100000).safeParse(params.version);
  if (!parsed.success) throw Errors.notFound();
  return ok(await restoreRevision(user, params.workspaceId, params.designId, parsed.data, requestInfo));
});
