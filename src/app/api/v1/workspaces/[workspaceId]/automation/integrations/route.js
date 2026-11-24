import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { createIntegration, listIntegrations } from "@/modules/automation/integrations-service.js";
import { integrationSchema } from "@/modules/automation/schemas.js";

export const GET = route({}, async ({ user, params }) => ok(await listIntegrations(user, params.workspaceId)));

/** Connects a channel; secrets are encrypted and never returned (a webhook's signing secret is shown once). */
export const POST = route({}, async ({ user, params, json, requestInfo }) => ok(await createIntegration(user, params.workspaceId, parseWith(integrationSchema, await json()), requestInfo), { status: 201 }));
