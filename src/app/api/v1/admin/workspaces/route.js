import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { listWorkspaces } from "@/server/platform/admin-service.js";
import { searchSchema } from "@/validation/admin.js";

export const GET = route({}, async ({ user, request }) => ok(await listWorkspaces(user, parseWith(searchSchema, Object.fromEntries(new URL(request.url).searchParams)))));
