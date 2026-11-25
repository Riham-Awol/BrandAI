import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { listPlatformAudit } from "@/server/platform/admin-service.js";
import { platformAuditSchema } from "@/validation/admin.js";

export const GET = route({}, async ({ user, request }) => ok(await listPlatformAudit(user, parseWith(platformAuditSchema, Object.fromEntries(new URL(request.url).searchParams)))));
