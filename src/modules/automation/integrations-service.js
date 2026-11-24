import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db/prisma.js";
import { Errors, isAppError } from "@/server/errors.js";
import { recordAudit } from "@/server/audit/service.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { decryptSecret, encryptSecret } from "@/server/crypto/secrets.js";
import { ADAPTERS } from "@/server/integrations/adapters.js";
import { assertSafeUrl } from "@/server/integrations/net-guard.js";
import { uuidSchema } from "@/validation/common.js";
import { logRun } from "./history.js";

const select = { id: true, type: true, name: true, config: true, status: true, lastUsedAt: true, lastError: true, createdAt: true };

/** Splits validated input into display config (non-secret) and encrypted secrets. */
function splitInput(input) {
  if (input.type === "WEBHOOK") {
    const url = assertSafeUrl(input.url);
    const signingSecret = randomBytes(24).toString("base64url");
    return { config: { host: url.host }, secret: { url: url.toString(), signingSecret }, reveal: { signingSecret } };
  }
  if (input.type === "TELEGRAM") return { config: { chatId: input.chatId }, secret: { botToken: input.botToken } };
  return { config: { pageId: input.pageId }, secret: { accessToken: input.accessToken } };
}

export async function listIntegrations(user, workspaceId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  return prisma.integration.findMany({ where: { workspaceId: scope.workspaceId, deletedAt: null }, orderBy: { createdAt: "asc" }, select });
}

/** Connects a channel. A webhook's signing secret is returned once, here, so the receiver can verify signatures. */
export async function createIntegration(user, workspaceId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.AUTOMATION_MANAGE);
  const { config, secret, reveal } = splitInput(input);
  const row = await prisma.integration.create({ data: { workspaceId: scope.workspaceId, type: input.type, name: input.name, config, secretEncrypted: encryptSecret(secret), createdById: user.id }, select });
  await recordAudit({ action: "integration.connected", actorId: user.id, workspaceId, entityType: "integration", entityId: row.id, metadata: { type: input.type }, request });
  return { ...row, reveal: reveal ?? null };
}

async function findIntegration(scope, id) {
  if (!uuidSchema.safeParse(id).success) throw Errors.notFound();
  const row = await prisma.integration.findFirst({ where: { id, workspaceId: scope.workspaceId, deletedAt: null } });
  if (!row) throw Errors.notFound();
  return row;
}

/** Loads an integration with decrypted secrets for the runner (no auth: the runner checks policy). */
export async function loadIntegrationForUse(workspaceId, id) {
  const row = await prisma.integration.findFirst({ where: { id, workspaceId, deletedAt: null } });
  if (!row) return null;
  return { ...row, secret: decryptSecret(row.secretEncrypted) };
}

export async function testIntegration(user, workspaceId, id, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.AUTOMATION_MANAGE);
  const row = await findIntegration(scope, id);
  try {
    const result = await ADAPTERS[row.type].test({ secret: decryptSecret(row.secretEncrypted), config: row.config });
    await prisma.integration.update({ where: { id: row.id }, data: { status: "ACTIVE", lastError: null, lastUsedAt: new Date() } });
    await logRun(scope.workspaceId, { kind: "integration_test", outcome: "SUCCESS", message: `Connection test for “${row.name}” succeeded${result.ref ? ` (${result.ref})` : ""}.`, actorId: user.id });
    return { ok: true, ref: result.ref ?? null };
  } catch (error) {
    const message = isAppError(error) ? error.message : "The connection test failed.";
    await prisma.integration.update({ where: { id: row.id }, data: { status: "ERROR", lastError: message.slice(0, 500) } });
    await logRun(scope.workspaceId, { kind: "integration_test", outcome: "FAILED", message: `Connection test for “${row.name}” failed: ${message}`, actorId: user.id });
    await recordAudit({ action: "integration.test_failed", actorId: user.id, workspaceId, entityType: "integration", entityId: row.id, request });
    return { ok: false, error: message };
  }
}

export async function setIntegrationEnabled(user, workspaceId, id, enabled, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.AUTOMATION_MANAGE);
  const row = await findIntegration(scope, id);
  await prisma.integration.update({ where: { id: row.id }, data: { status: enabled ? "ACTIVE" : "DISABLED" } });
  await recordAudit({ action: enabled ? "integration.enabled" : "integration.disabled", actorId: user.id, workspaceId, entityType: "integration", entityId: row.id, request });
  return listIntegrations(user, workspaceId);
}

export async function deleteIntegration(user, workspaceId, id, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.AUTOMATION_MANAGE);
  const row = await findIntegration(scope, id);
  // Secrets are wiped on removal; scheduled items fall back to manual posting.
  await prisma.integration.update({ where: { id: row.id }, data: { deletedAt: new Date(), status: "DISABLED", secretEncrypted: "" } });
  await recordAudit({ action: "integration.removed", actorId: user.id, workspaceId, entityType: "integration", entityId: row.id, request });
}
