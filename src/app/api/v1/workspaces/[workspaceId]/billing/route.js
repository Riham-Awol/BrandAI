import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { getBilling } from "@/server/billing/service.js";

export const GET = route({}, async ({ user, params }) => ok(await getBilling(user, params.workspaceId)));
