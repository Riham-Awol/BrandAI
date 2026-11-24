import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { deleteRule, updateRule } from "@/modules/automation/rules-service.js";
import { ruleUpdateSchema } from "@/modules/automation/schemas.js";

export const PATCH = route({}, async ({ user, params, json, requestInfo }) => ok(await updateRule(user, params.workspaceId, params.ruleId, parseWith(ruleUpdateSchema, await json()), requestInfo)));

export const DELETE = route({}, async ({ user, params, requestInfo }) => {
  await deleteRule(user, params.workspaceId, params.ruleId, requestInfo);
  return ok({ deleted: true });
});
