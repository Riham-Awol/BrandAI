import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { transferOwnership } from "@/server/workspaces/team-service.js";
import { transferSchema } from "@/validation/team.js";

export const POST = route({ rateLimit: "login" }, async ({ user, params, json, requestInfo }) => ok(await transferOwnership(user, params.workspaceId, parseWith(transferSchema, await json()), requestInfo)));
