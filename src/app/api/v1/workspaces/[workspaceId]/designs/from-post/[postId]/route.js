import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { getPostPrefill } from "@/modules/design/service.js";

/** Brief pre-fill for designing a social post. */
export const GET = route({}, async ({ user, params }) => ok(await getPostPrefill(user, params.workspaceId, params.postId)));
