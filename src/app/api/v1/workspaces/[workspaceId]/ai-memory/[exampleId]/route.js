import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { deleteAiExample } from "@/server/ai/memory.js";

export const DELETE = route({}, async ({ user, params, requestInfo }) => ok(await deleteAiExample(user, params.workspaceId, params.exampleId, requestInfo)));
