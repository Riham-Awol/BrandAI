import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { removeCustomDomain, setCustomDomain } from "@/modules/website/service.js";
import { domainSchema } from "@/modules/website/schemas.js";

/** Connects a custom domain (returns the DNS records to add). */
export const PUT = route({}, async ({ user, params, json, requestInfo }) => {
  const { domain } = parseWith(domainSchema, await json());
  return ok(await setCustomDomain(user, params.workspaceId, params.websiteId, domain, requestInfo));
});

export const DELETE = route({}, async ({ user, params, requestInfo }) => ok(await removeCustomDomain(user, params.workspaceId, params.websiteId, requestInfo)));
