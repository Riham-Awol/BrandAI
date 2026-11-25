import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { setWorkspacePlan } from "@/server/platform/admin-service.js";
import { setPlanSchema } from "@/validation/admin.js";

export const PUT = route({}, async ({ user, params, json, requestInfo }) => ok(await setWorkspacePlan(user, params.workspaceId, parseWith(setPlanSchema, await json()), requestInfo)));
