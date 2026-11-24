import "server-only";
import { prisma } from "../db/prisma.js";
import { recordAudit, AUDIT_ACTIONS } from "../audit/service.js";
import { requireWorkspaceAccess } from "../permissions/authorize.js";
import { PERMISSIONS, permissionsForRole } from "../permissions/roles.js";
import { DEFAULT_USAGE_LIMITS } from "../usage/defaults.js";
import { uniqueSlug } from "./slug.js";

/**
 * Creates a workspace with the creator as OWNER and default usage limits.
 * Pass `tx` to run inside an existing transaction (e.g. registration).
 */
export async function createWorkspaceForUser({ userId, name, type = "TEAM" }, tx = prisma) {
  const workspace = await tx.workspace.create({
    data: {
      name,
      type,
      slug: uniqueSlug(name),
      ownerId: userId,
      members: { create: { userId, role: "OWNER" } },
      usageLimits: { create: DEFAULT_USAGE_LIMITS },
    },
    select: { id: true, name: true, slug: true, type: true, createdAt: true },
  });
  await recordAudit(
    { action: AUDIT_ACTIONS.WORKSPACE_CREATED, actorId: userId, workspaceId: workspace.id, entityType: "workspace", entityId: workspace.id },
    tx,
  );
  return workspace;
}

/** Workspaces the user belongs to (never other users' workspaces). */
export async function listWorkspacesForUser(userId) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId, workspace: { deletedAt: null } },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      workspace: { select: { id: true, name: true, slug: true, type: true, createdAt: true } },
    },
  });
  return memberships.map((m) => ({ ...m.workspace, role: m.role }));
}

export async function getWorkspace(user, workspaceId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.WORKSPACE_READ);
  const memberCount = await prisma.workspaceMember.count({ where: { workspaceId } });
  return { ...scope.workspace, deletedAt: undefined, role: scope.role, permissions: permissionsForRole(scope.role), memberCount };
}

/**
 * Resolves the workspace a signed-in user is working in: the requested one if
 * they are a member, otherwise their first workspace.
 */
export async function resolveActiveWorkspace(userId, requestedId) {
  const workspaces = await listWorkspacesForUser(userId);
  const active = workspaces.find((w) => w.id === requestedId) ?? workspaces[0] ?? null;
  return { active, workspaces };
}
