import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { listDesigns, saveDesign } from "@/modules/design/service.js";
import { saveDesignSchema } from "@/modules/design/schemas.js";

/** Saved designs in the workspace; `?businessId=` filters. */
export const GET = route({}, async ({ user, params, request }) => {
  const businessId = new URL(request.url).searchParams.get("businessId") ?? undefined;
  return ok(await listDesigns(user, params.workspaceId, { businessId }));
});

/** Saves a chosen option as a design (version 1). */
export const POST = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(saveDesignSchema, await json());
  return ok(await saveDesign(user, params.workspaceId, input, requestInfo), { status: 201 });
});
