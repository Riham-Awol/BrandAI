import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { z } from "zod";
import { deleteIntegration, setIntegrationEnabled } from "@/modules/automation/integrations-service.js";

const schema = z.object({ enabled: z.boolean() });

export const PATCH = route({}, async ({ user, params, json, requestInfo }) => ok(await setIntegrationEnabled(user, params.workspaceId, params.integrationId, parseWith(schema, await json()).enabled, requestInfo)));

export const DELETE = route({}, async ({ user, params, requestInfo }) => {
  await deleteIntegration(user, params.workspaceId, params.integrationId, requestInfo);
  return ok({ deleted: true });
});
