import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { setWorkspaceSuspended } from "@/server/platform/admin-service.js";
import { suspendSchema } from "@/validation/admin.js";

export const PUT = route({}, async ({ user, params, json, requestInfo }) => ok(await setWorkspaceSuspended(user, params.workspaceId, parseWith(suspendSchema, await json()), requestInfo)));
