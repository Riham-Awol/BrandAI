import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { clearAiMemory, getAiMemory } from "@/server/ai/memory.js";
import { aiMemoryQuerySchema } from "@/validation/team.js";

const query = (request) => parseWith(aiMemoryQuerySchema, Object.fromEntries(new URL(request.url).searchParams));

/** What the AI learned from approvals (`?businessId=`); DELETE forgets it all (or one business's). */
export const GET = route({}, async ({ user, params, request }) => ok(await getAiMemory(user, params.workspaceId, query(request))));
export const DELETE = route({}, async ({ user, params, request, requestInfo }) => ok(await clearAiMemory(user, params.workspaceId, query(request), requestInfo)));
