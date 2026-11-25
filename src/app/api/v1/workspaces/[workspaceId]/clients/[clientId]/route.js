import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { updateClient } from "@/server/workspaces/agency-service.js";
import { clientUpdateSchema } from "@/validation/team.js";

export const PATCH = route({}, async ({ user, params, json, requestInfo }) => ok(await updateClient(user, params.workspaceId, params.clientId, parseWith(clientUpdateSchema, await json()), requestInfo)));
