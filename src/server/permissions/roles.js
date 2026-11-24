/**
 * Role-based permissions for workspace members. Pure data + pure functions so
 * they can be unit-tested and reused by every module.
 *
 * Add new permissions here as phases introduce new capabilities; never check
 * roles directly in module code — always check a permission.
 */
export const ROLES = ["OWNER", "ADMIN", "EDITOR", "VIEWER"];

export const PERMISSIONS = {
  WORKSPACE_READ: "workspace:read",
  WORKSPACE_UPDATE: "workspace:update",
  WORKSPACE_DELETE: "workspace:delete",
  MEMBERS_READ: "members:read",
  MEMBERS_MANAGE: "members:manage",
  BUSINESS_READ: "business:read",
  BUSINESS_CREATE: "business:create",
  BUSINESS_UPDATE: "business:update",
  BUSINESS_DELETE: "business:delete",
  CONTEXT_APPROVE: "context:approve",
  AI_GENERATE: "ai:generate",
  FILES_UPLOAD: "files:upload",
  FILES_DELETE: "files:delete",
  USAGE_READ: "usage:read",
  AUDIT_READ: "audit:read",
  BILLING_MANAGE: "billing:manage",
  // Phase 6: publishing a website and connecting domains are public, outward-facing actions.
  WEBSITE_PUBLISH: "website:publish",
  // Phase 8: approving outward actions, managing automation/integrations, and switching on autopilot.
  AUTOMATION_APPROVE: "automation:approve",
  AUTOMATION_MANAGE: "automation:manage",
  AUTOMATION_AUTOPILOT: "automation:autopilot",
};

const P = PERMISSIONS;

const VIEWER = [P.WORKSPACE_READ, P.MEMBERS_READ, P.BUSINESS_READ];
const EDITOR = [...VIEWER, P.BUSINESS_CREATE, P.BUSINESS_UPDATE, P.AI_GENERATE, P.FILES_UPLOAD, P.USAGE_READ];
const ADMIN = [
  ...EDITOR,
  P.WORKSPACE_UPDATE,
  P.MEMBERS_MANAGE,
  P.BUSINESS_DELETE,
  P.CONTEXT_APPROVE,
  P.FILES_DELETE,
  P.AUDIT_READ,
  P.WEBSITE_PUBLISH,
  P.AUTOMATION_APPROVE,
  P.AUTOMATION_MANAGE,
];
const OWNER = [...ADMIN, P.WORKSPACE_DELETE, P.BILLING_MANAGE, P.AUTOMATION_AUTOPILOT];

export const ROLE_PERMISSIONS = Object.freeze({
  OWNER: new Set(OWNER),
  ADMIN: new Set(ADMIN),
  EDITOR: new Set(EDITOR),
  VIEWER: new Set(VIEWER),
});

export function roleHasPermission(role, permission) {
  const set = ROLE_PERMISSIONS[role];
  return Boolean(set && set.has(permission));
}

export function permissionsForRole(role) {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}
