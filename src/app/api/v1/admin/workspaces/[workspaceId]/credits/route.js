import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { grantCredits } from "@/server/platform/admin-service.js";
import { grantCreditsSchema } from "@/validation/admin.js";

export const POST = route({}, async ({ user, params, json, requestInfo }) => ok(await grantCredits(user, params.workspaceId, parseWith(grantCreditsSchema, await json()), requestInfo)));
