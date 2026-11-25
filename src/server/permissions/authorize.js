import "server-only";
import { prisma } from "../db/prisma.js";
import { Errors } from "../errors.js";
import { roleHasPermission } from "./roles.js";
import { uuidSchema } from "@/validation/common.js";

/**
 * Loads the caller's membership in a workspace and enforces a permission.
 *
 * Returns a "workspace scope" object that services use for every query, so
 * all data access is tied to a workspace the user actually belongs to.
 * Non-members get NOT_FOUND (not FORBIDDEN) so workspace ids cannot be probed.
 */
export async function requireWorkspaceAccess(user, workspaceId, permission) {
  if (!user?.id) throw Errors.unauthenticated();
  if (!uuidSchema.safeParse(workspaceId).success) throw Errors.notFound();

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    select: { role: true, workspace: { select: { id: true, name: true, slug: true, type: true, deletedAt: true, suspendedAt: true, agencyWorkspaceId: true } } },
  });

  if (!membership || membership.workspace.deletedAt) throw Errors.notFound();
  if (membership.workspace.suspendedAt) throw Errors.forbidden("This workspace is suspended. Contact support.");
  if (permission && !roleHasPermission(membership.role, permission)) throw Errors.forbidden();

  return Object.freeze({
    userId: user.id,
    workspaceId,
    role: membership.role,
    workspace: membership.workspace,
    can: (p) => roleHasPermission(membership.role, p),
  });
}
