import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { Errors } from "@/server/errors.js";
import { recordAudit } from "@/server/audit/service.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { getEnv } from "@/server/config/env.js";
import { encryptionConfigured } from "@/server/crypto/secrets.js";
import { logRun } from "./history.js";

const DEFAULTS = { mode: "DRAFT_ONLY", dailyPublishLimit: 10, dailyEmailLimit: 200, requireSeparateApprover: false, timezone: "Europe/London" };

/** Settings row for a workspace (defaults when never saved). No auth: callers authorize. */
export async function loadSettings(workspaceId) {
  const row = await prisma.automationSettings.findUnique({ where: { workspaceId } });
  return row ?? { ...DEFAULTS, workspaceId };
}

export async function getAutomationSettings(user, workspaceId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const s = await loadSettings(scope.workspaceId);
  const env = getEnv();
  return {
    mode: s.mode, dailyPublishLimit: s.dailyPublishLimit, dailyEmailLimit: s.dailyEmailLimit, requireSeparateApprover: s.requireSeparateApprover, timezone: s.timezone,
    permissions: {
      canSchedule: scope.can(PERMISSIONS.BUSINESS_UPDATE),
      canApprove: scope.can(PERMISSIONS.AUTOMATION_APPROVE),
      canManage: scope.can(PERMISSIONS.AUTOMATION_MANAGE),
      canEnableAutopilot: scope.can(PERMISSIONS.AUTOMATION_AUTOPILOT),
    },
    platform: {
      emailProvider: env.EMAIL_PROVIDER,
      emailDelivers: env.EMAIL_PROVIDER === "resend" && Boolean(env.RESEND_API_KEY),
      encryptionConfigured: encryptionConfigured(),
      schedulerConfigured: Boolean(env.CRON_SECRET),
    },
  };
}

/** Changing the mode is audited; switching ON authorized automation needs the owner. */
export async function saveAutomationSettings(user, workspaceId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.AUTOMATION_MANAGE);
  const current = await loadSettings(scope.workspaceId);
  if (input.mode === "AUTOMATED" && current.mode !== "AUTOMATED" && !scope.can(PERMISSIONS.AUTOMATION_AUTOPILOT)) {
    throw Errors.forbidden("Only the workspace owner can switch on authorized automation.");
  }
  await prisma.automationSettings.upsert({ where: { workspaceId: scope.workspaceId }, create: { workspaceId: scope.workspaceId, ...input, updatedById: user.id }, update: { ...input, updatedById: user.id } });
  if (input.mode !== current.mode) {
    await logRun(scope.workspaceId, { kind: "settings", outcome: "SUCCESS", message: `Automation mode changed from ${current.mode} to ${input.mode}.`, actorId: user.id });
  }
  await recordAudit({ action: "automation.settings_updated", actorId: user.id, workspaceId, entityType: "workspace", entityId: scope.workspaceId, metadata: { from: current.mode, to: input.mode, dailyPublishLimit: input.dailyPublishLimit, dailyEmailLimit: input.dailyEmailLimit }, request });
  return getAutomationSettings(user, workspaceId);
}
