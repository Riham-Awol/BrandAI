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
  // Phase 10
  PROFILE_UPDATED: "user.profile_updated",
  PASSWORD_CHANGED: "user.password_changed",
  SESSIONS_REVOKED: "user.sessions_revoked",
  EMAIL_VERIFICATION_SENT: "user.email_verification_sent",
  EMAIL_VERIFIED: "user.email_verified",
  MFA_ENABLED: "user.mfa_enabled",
  MFA_DISABLED: "user.mfa_disabled",
  MFA_RECOVERY_USED: "user.mfa_recovery_used",
  MFA_RECOVERY_REGENERATED: "user.mfa_recovery_regenerated",
  ACCOUNT_DELETED: "user.account_deleted",
  WORKSPACE_UPDATED: "workspace.updated",
  WORKSPACE_DELETED: "workspace.deleted",
  WORKSPACE_TRANSFERRED: "workspace.ownership_transferred",
  MEMBER_INVITED: "member.invited",
  INVITATION_REVOKED: "member.invitation_revoked",
  MEMBER_JOINED: "member.joined",
  MEMBER_ROLE_CHANGED: "member.role_changed",
  MEMBER_REMOVED: "member.removed",
  MEMBER_LEFT: "member.left",
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
