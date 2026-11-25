import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { getPlatformOverview } from "@/server/platform/admin-service.js";

/** Platform admins only (404 for everyone else). */
export const GET = route({}, async ({ user }) => ok(await getPlatformOverview(user)));
