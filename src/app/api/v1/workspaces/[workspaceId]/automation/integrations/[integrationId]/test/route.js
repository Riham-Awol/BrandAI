import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { testIntegration } from "@/modules/automation/integrations-service.js";

/** Sends a harmless test (webhook "brandai.test", Telegram getMe, Facebook page lookup). */
export const POST = route({}, async ({ user, params, requestInfo }) => ok(await testIntegration(user, params.workspaceId, params.integrationId, requestInfo)));
