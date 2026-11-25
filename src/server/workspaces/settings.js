import "server-only";
import { requireWorkspaceAccess } from "../permissions/authorize.js";
import { PERMISSIONS } from "../permissions/roles.js";

/** Settings tabs this member may open in the active workspace. */
export async function getSettingsLinks(user, workspaceId) {
  const links = [["/settings", "Account & security"]];
  if (!workspaceId) return links;
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.WORKSPACE_READ).catch(() => null);
  if (!scope) return links;
  links.push(["/settings/workspace", "Workspace"], ["/settings/members", "Team"]);
  if (scope.can(PERMISSIONS.USAGE_READ)) links.push(["/settings/billing", "Plan & usage"]);
  if (scope.workspace?.type === "AGENCY") links.push(["/settings/clients", "Clients"]);
  if (scope.can(PERMISSIONS.AUDIT_READ)) links.push(["/settings/audit", "Audit log"]);
  return links;
}
