import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { z } from "zod";
import { decideItem } from "@/modules/automation/queue-service.js";

const schema = z.object({ approve: z.boolean(), note: z.string().trim().max(500).optional().transform((v) => (v === "" ? undefined : v)) });

/** Approve or reject (automation:approve). */
export const POST = route({}, async ({ user, params, json, requestInfo }) => ok(await decideItem(user, params.workspaceId, params.itemId, parseWith(schema, await json()), requestInfo)));
