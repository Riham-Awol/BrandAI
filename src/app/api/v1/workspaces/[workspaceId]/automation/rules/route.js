import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { createRule, listRules } from "@/modules/automation/rules-service.js";
import { ruleSchema } from "@/modules/automation/schemas.js";

export const GET = route({}, async ({ user, params }) => ok(await listRules(user, params.workspaceId)));
export const POST = route({}, async ({ user, params, json, requestInfo }) => ok(await createRule(user, params.workspaceId, parseWith(ruleSchema, await json()), requestInfo), { status: 201 }));
