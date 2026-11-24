import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { runAutomationForWorkspace } from "@/modules/automation/runner.js";

export const maxDuration = 300;

/** "Run now" for this workspace (automation:manage). */
export const POST = route({}, async ({ user, params, requestInfo }) => ok(await runAutomationForWorkspace(user, params.workspaceId, requestInfo)));
