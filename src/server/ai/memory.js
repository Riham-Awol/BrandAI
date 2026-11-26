import "server-only";
import { prisma } from "../db/prisma.js";
import { Errors } from "../errors.js";
import { logger } from "../logger.js";
import { recordAudit } from "../audit/service.js";
import { requireWorkspaceAccess } from "../permissions/authorize.js";
import { PERMISSIONS } from "../permissions/roles.js";
import { uuidSchema } from "@/validation/common.js";

/**
 * "Learning from approvals" without training a model: when people approve an
 * AI output (or approve it after editing), it is kept as an example for that
 * business and task. Later requests for the same business and task include a
 * few recent examples so the AI follows what this business liked. Free, works
 * with any provider, and each workspace can switch it off or forget examples.
 */

export const MAX_EXAMPLES_IN_PROMPT = 3;
const MAX_EXAMPLE_CHARS = 1500;
const KEEP_PER_TASK = 20;

/** Compact, size-limited text for the prompt (JSON content is pretty-printed then cut). Pure. */
export function exampleText(content) {
  const text = typeof content === "string" ? content : JSON.stringify(content, null, 1);
  return text.length > MAX_EXAMPLE_CHARS ? `${text.slice(0, MAX_EXAMPLE_CHARS)}…` : text;
}

/** The prompt block with examples, or "" when there are none. Pure. */
export function examplesBlock(examples) {
  if (!examples.length) return "";
  const items = examples.map((e, i) => `<example n="${i + 1}" ${e.source === "EDITED" ? 'edited_by_the_business="true"' : ""}>\n${exampleText(e.content)}\n</example>`).join("\n");
  return `<approved_examples>\nEarlier results this business approved for the same task (newest first). Match their tone, style, structure and level of detail. They are style references only: don't copy them word for word, and only reuse facts that also appear in the business context or the user input.\n${items}\n</approved_examples>`;
}

/**
 * Saves an approved output as an example (idempotent per source). Never throws:
 * learning must not break the action that triggered it. Mock outputs are ignored.
 */
export async function rememberApproved({ workspaceId, businessId, module, task, content, source = "APPROVED", sourceRef, userId, isMock }) {
  if (isMock || !businessId || content == null) return null;
  try {
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { aiLearningEnabled: true } });
    if (!ws?.aiLearningEnabled) return null;
    const row = await prisma.aiExample.upsert({
      where: { sourceRef: String(sourceRef).slice(0, 80) },
      create: { workspaceId, businessId, module, task, source, content, sourceRef: String(sourceRef).slice(0, 80), createdById: userId ?? null },
      update: { content, source },
      select: { id: true },
    });
    // Keep the memory small: only the newest examples per business and task.
    const old = await prisma.aiExample.findMany({ where: { businessId, module, task }, orderBy: { updatedAt: "desc" }, skip: KEEP_PER_TASK, select: { id: true } });
    if (old.length) await prisma.aiExample.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    return row;
  } catch (error) {
    logger.warn("Could not save an AI example", { module, task, code: error?.code });
    return null;
  }
}

/** Removes the example created from a source (e.g. a post that is no longer "ready"). */
export async function forgetSource(sourceRef) {
  await prisma.aiExample.deleteMany({ where: { sourceRef: String(sourceRef).slice(0, 80) } }).catch(() => {});
}

/** Examples for a prompt (no auth: called by the orchestrator after its own checks). */
export async function examplesForPrompt({ workspaceId, businessId, module, task }) {
  if (!businessId) return [];
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { aiLearningEnabled: true } });
  if (!ws?.aiLearningEnabled) return [];
  return prisma.aiExample.findMany({
    where: { workspaceId, businessId, module, task },
    orderBy: { updatedAt: "desc" },
    take: MAX_EXAMPLES_IN_PROMPT,
    select: { id: true, source: true, content: true },
  });
}

const label = (s) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** What the AI has learned, for the "AI memory" settings page. */
export async function getAiMemory(user, workspaceId, { businessId } = {}) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const ws = await prisma.workspace.findUnique({ where: { id: scope.workspaceId }, select: { aiLearningEnabled: true } });
  const businesses = await prisma.business.findMany({ where: { workspaceId: scope.workspaceId, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const filter = businessId && businesses.some((b) => b.id === businessId) ? businessId : null;
  if (businessId && !filter) throw Errors.notFound();
  const rows = await prisma.aiExample.findMany({
    where: { workspaceId: scope.workspaceId, ...(filter ? { businessId: filter } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: { id: true, businessId: true, module: true, task: true, source: true, content: true, updatedAt: true },
  });
  return {
    enabled: ws.aiLearningEnabled,
    businesses,
    examples: rows.map((r) => ({ ...r, label: `${label(r.module)} · ${label(r.task)}`, preview: exampleText(r.content).slice(0, 280) })),
    permissions: { canEdit: scope.can(PERMISSIONS.BUSINESS_UPDATE), canToggle: scope.can(PERMISSIONS.WORKSPACE_UPDATE) },
  };
}

export async function deleteAiExample(user, workspaceId, exampleId, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  if (!uuidSchema.safeParse(exampleId).success) throw Errors.notFound();
  const { count } = await prisma.aiExample.deleteMany({ where: { id: exampleId, workspaceId: scope.workspaceId } });
  if (!count) throw Errors.notFound();
  await recordAudit({ action: "ai.memory_example_deleted", actorId: user.id, workspaceId, entityType: "ai_example", entityId: exampleId, request });
  return { deleted: true };
}

/** Forgets everything (optionally for one business). */
export async function clearAiMemory(user, workspaceId, { businessId } = {}, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  if (businessId && !uuidSchema.safeParse(businessId).success) throw Errors.notFound();
  const { count } = await prisma.aiExample.deleteMany({ where: { workspaceId: scope.workspaceId, ...(businessId ? { businessId } : {}) } });
  await recordAudit({ action: "ai.memory_cleared", actorId: user.id, workspaceId, metadata: { businessId: businessId ?? null, count }, request });
  return { deleted: count };
}

/** Switches learning on/off for the workspace (admins/owner). Off also stops using saved examples. */
export async function setAiLearning(user, workspaceId, { enabled }, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.WORKSPACE_UPDATE);
  await prisma.workspace.update({ where: { id: scope.workspaceId }, data: { aiLearningEnabled: enabled } });
  await recordAudit({ action: enabled ? "ai.learning_enabled" : "ai.learning_disabled", actorId: user.id, workspaceId, request });
  return { enabled };
}
