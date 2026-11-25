import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { createClient, listClients } from "@/server/workspaces/agency-service.js";
import { clientSchema } from "@/validation/team.js";

/** Agency workspaces: clients, each with its own workspace. */
export const GET = route({}, async ({ user, params }) => ok(await listClients(user, params.workspaceId)));
export const POST = route({}, async ({ user, params, json, requestInfo }) => ok(await createClient(user, params.workspaceId, parseWith(clientSchema, await json()), requestInfo), { status: 201 }));
