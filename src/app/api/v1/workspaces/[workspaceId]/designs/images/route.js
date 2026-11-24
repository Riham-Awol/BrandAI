import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { listDesignImages } from "@/modules/design/service.js";

/** Image brand assets a design can use (`?businessId=`). */
export const GET = route({}, async ({ user, params, request }) => {
  const businessId = new URL(request.url).searchParams.get("businessId") ?? "";
  return ok(await listDesignImages(user, params.workspaceId, businessId));
});
