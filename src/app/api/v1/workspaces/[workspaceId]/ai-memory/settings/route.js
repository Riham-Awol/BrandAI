import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { setAiLearning } from "@/server/ai/memory.js";
import { aiLearningSchema } from "@/validation/team.js";

/** Switches learning from approvals on/off for the workspace (admins, owner). */
export const PUT = route({}, async ({ user, params, json, requestInfo }) => ok(await setAiLearning(user, params.workspaceId, parseWith(aiLearningSchema, await json()), requestInfo)));
