import "server-only";
import { prisma } from "../db/prisma.js";
import { logger } from "../logger.js";

/** Canonical audit action names. Add new ones per phase. */
export const AUDIT_ACTIONS = {
  USER_REGISTERED: "user.registered",
  USER_LOGIN: "user.login",
  USER_LOGIN_FAILED: "user.login_failed",
  USER_LOCKED: "user.locked",
  PASSWORD_RESET_REQUESTED: "user.password_reset_requested",
  PASSWORD_RESET_COMPLETED: "user.password_reset_completed",
  WORKSPACE_CREATED: "workspace.created",
  BUSINESS_CREATED: "business.created",
  BUSINESS_UPDATED: "business.updated",
  BUSINESS_DELETED: "business.deleted",
  CONTEXT_DRAFT_SAVED: "business_context.draft_saved",
  CONTEXT_APPROVED: "business_context.approved",
  AI_GENERATION: "ai.generation",
  FILE_UPLOADED: "file.uploaded",
  FILE_DELETED: "file.deleted",
};

/**
 * Writes an audit entry. Audit failures are logged but never break the
 * user's action. Pass `tx` to write inside an existing transaction.
 */
export async function recordAudit({ action, actorId, workspaceId, entityType, entityId, metadata, request }, tx = prisma) {
  try {
    await tx.auditLog.create({
      data: {
        action,
        actorId: actorId ?? null,
        workspaceId: workspaceId ?? null,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        metadata: metadata ?? undefined,
        ipAddress: request?.ip?.slice(0, 64) ?? null,
        userAgent: request?.userAgent?.slice(0, 500) ?? null,
      },
    });
  } catch (error) {
    logger.error("Failed to write audit log", { action, error });
  }
}
