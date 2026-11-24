import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { verifyCustomDomain } from "@/modules/website/service.js";

/** Checks the domain's TXT record. */
export const POST = route({}, async ({ user, params, requestInfo }) => ok(await verifyCustomDomain(user, params.workspaceId, params.websiteId, requestInfo)));
