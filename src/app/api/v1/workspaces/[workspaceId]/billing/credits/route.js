import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { buyCredits } from "@/server/billing/service.js";
import { creditsSchema } from "@/validation/team.js";

export const POST = route({}, async ({ user, params, json, requestInfo }) => ok(await buyCredits(user, params.workspaceId, parseWith(creditsSchema, await json()), requestInfo)));
