import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { listAuditLog } from "@/server/workspaces/team-service.js";
import { auditQuerySchema } from "@/validation/team.js";

/** Workspace audit log (audit:read): `?action=member.&before=<ISO>`. */
export const GET = route({}, async ({ user, params, request }) => ok(await listAuditLog(user, params.workspaceId, parseWith(auditQuerySchema, Object.fromEntries(new URL(request.url).searchParams)))));
