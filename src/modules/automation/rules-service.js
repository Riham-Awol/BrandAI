import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { Errors } from "@/server/errors.js";
import { recordAudit } from "@/server/audit/service.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { uuidSchema } from "@/validation/common.js";
import { RULE_TEMPLATES } from "./catalog.js";
import { logRun } from "./history.js";

const select = { id: true, template: true, name: true, params: true, enabled: true, lastRunAt: true, createdAt: true };

export async function listRules(user, workspaceId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  return prisma.automationRule.findMany({ where: { workspaceId: scope.workspaceId, deletedAt: null }, orderBy: { createdAt: "asc" }, select });
}

/** Rules are preset recipes with validated parameters — never user code. */
export async function createRule(user, workspaceId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.AUTOMATION_MANAGE);
  const t = RULE_TEMPLATES[input.template];
  const params = {};
  if (t.params.includes("integrationId")) {
    if (input.integrationId) {
      const i = await prisma.integration.findFirst({ where: { id: input.integrationId, workspaceId: scope.workspaceId, deletedAt: null } });
      if (!i) throw Errors.validation({ integrationId: ["Choose a connected channel."] });
      if (input.template === "forward_website_messages" && i.type !== "WEBHOOK") throw Errors.validation({ integrationId: ["Website messages can only be forwarded to a webhook."] });
      params.integrationId = i.id;
    } else if (input.template === "forward_website_messages") throw Errors.validation({ integrationId: ["Choose a webhook."] });
    else params.integrationId = null;
  }
  if (t.params.includes("time")) params.time = input.time ?? "09:00";
  const rule = await prisma.automationRule.create({ data: { workspaceId: scope.workspaceId, template: input.template, name: input.name, params, enabled: input.enabled, lastRunAt: new Date(), createdById: user.id }, select });
  await logRun(scope.workspaceId, { kind: "rule", outcome: "SUCCESS", message: `Rule “${rule.name}” created.`, ruleId: rule.id, actorId: user.id });
  await recordAudit({ action: "automation.rule_created", actorId: user.id, workspaceId, entityType: "automation_rule", entityId: rule.id, metadata: { template: input.template }, request });
  return rule;
}

export async function updateRule(user, workspaceId, id, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.AUTOMATION_MANAGE);
  if (!uuidSchema.safeParse(id).success) throw Errors.notFound();
  const rule = await prisma.automationRule.findFirst({ where: { id, workspaceId: scope.workspaceId, deletedAt: null } });
  if (!rule) throw Errors.notFound();
  const updated = await prisma.automationRule.update({ where: { id: rule.id }, data: { ...(input.name ? { name: input.name } : {}), ...(input.enabled !== undefined ? { enabled: input.enabled, ...(input.enabled ? { lastRunAt: new Date() } : {}) } : {}) }, select });
  await recordAudit({ action: "automation.rule_updated", actorId: user.id, workspaceId, entityType: "automation_rule", entityId: rule.id, metadata: input, request });
  return updated;
}

export async function deleteRule(user, workspaceId, id, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.AUTOMATION_MANAGE);
  if (!uuidSchema.safeParse(id).success) throw Errors.notFound();
  const { count } = await prisma.automationRule.updateMany({ where: { id, workspaceId: scope.workspaceId, deletedAt: null }, data: { deletedAt: new Date(), enabled: false } });
  if (!count) throw Errors.notFound();
  await recordAudit({ action: "automation.rule_deleted", actorId: user.id, workspaceId, entityType: "automation_rule", entityId: id, request });
}
