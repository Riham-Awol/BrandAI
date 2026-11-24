import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { publishNow } from "@/modules/automation/runner.js";

export const maxDuration = 120;

/** A person with approval rights publishes/sends immediately (audited; daily limits still apply). */
export const POST = route({}, async ({ user, params, requestInfo }) => ok(await publishNow(user, params.workspaceId, params.itemId, requestInfo)));
