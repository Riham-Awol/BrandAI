import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { AppError, Errors } from "@/server/errors.js";
import { recordAudit } from "@/server/audit/service.js";
import { generateText } from "@/server/ai/orchestrator.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { findScopedBusiness } from "@/server/businesses/service.js";
import { flattenZodError, uuidSchema } from "@/validation/common.js";
import { SECTION_SCHEMAS } from "./schemas.js";
import { LAUNCH_SECTIONS, SECTION_BY_KEY } from "./sections.js";
import { buildInstructions, buildSectionInput, SECTION_AI_OPTIONS } from "./prompts.js";
import { renderLaunchPackMarkdown } from "./markdown.js";
import "./mock-fixtures.js";

const MODULE = "launch";

export const LAUNCH_AUDIT = {
  PROJECT_CREATED: "launch.project_created",
  PROJECT_UPDATED: "launch.project_updated",
  PROJECT_DELETED: "launch.project_deleted",
  SECTION_GENERATED: "launch.section_generated",
  SECTION_EDITED: "launch.section_edited",
  SECTION_ACCEPTED: "launch.section_accepted",
};

const versionSelect = { id: true, section: true, version: true, source: true, isAccepted: true, isMock: true, feedback: true, createdAt: true };

async function findScopedProject(scope, projectId) {
  if (!uuidSchema.safeParse(projectId).success) throw Errors.notFound();
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: scope.workspaceId, type: "LAUNCH_STUDIO", deletedAt: null, business: { deletedAt: null } },
    include: { business: { select: { id: true, name: true, industry: true, stage: true, status: true } } },
  });
  if (!project) throw Errors.notFound();
  return project;
}

function assertSection(section) {
  if (!SECTION_BY_KEY[section]) throw Errors.notFound();
}

/** Accepted version if one exists, otherwise the latest. */
async function activeOutputs(projectId, sections) {
  const rows = await prisma.projectOutput.findMany({
    where: { projectId, ...(sections ? { section: { in: sections } } : {}) },
    orderBy: [{ section: "asc" }, { version: "desc" }],
  });
  const active = {};
  for (const row of rows) {
    const current = active[row.section];
    if (!current || (row.isAccepted && !current.isAccepted)) active[row.section] = row;
  }
  return active;
}

// ── Projects ────────────────────────────────────────────────

export async function createLaunchProject(user, workspaceId, input, request) {
  const { businessId, ...idea } = input;
  const scope = await requireWorkspaceAccess(user, workspaceId, businessId ? PERMISSIONS.BUSINESS_UPDATE : PERMISSIONS.BUSINESS_CREATE);

  const project = await prisma.$transaction(async (tx) => {
    let business;
    if (businessId) {
      business = await findScopedBusiness(scope, businessId);
    } else {
      business = await tx.business.create({
        data: {
          workspaceId: scope.workspaceId,
          name: idea.businessName || "Untitled business",
          description: idea.idea,
          stage: idea.stage,
          createdById: user.id,
        },
      });
    }
    return tx.project.create({
      data: { workspaceId: scope.workspaceId, businessId: business.id, type: "LAUNCH_STUDIO", name: `${business.name} launch plan`, input: idea, createdById: user.id },
      select: { id: true, name: true, businessId: true, createdAt: true },
    });
  });
  await recordAudit({ action: LAUNCH_AUDIT.PROJECT_CREATED, actorId: user.id, workspaceId, entityType: "project", entityId: project.id, request });
  return project;
}

export async function listLaunchProjects(user, workspaceId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const projects = await prisma.project.findMany({
    where: { workspaceId: scope.workspaceId, type: "LAUNCH_STUDIO", deletedAt: null, business: { deletedAt: null } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, status: true, createdAt: true, updatedAt: true, business: { select: { id: true, name: true, stage: true } } },
  });
  if (projects.length === 0) return [];
  const groups = await prisma.projectOutput.groupBy({ by: ["projectId", "section"], where: { projectId: { in: projects.map((p) => p.id) } } });
  const done = new Map();
  for (const g of groups) done.set(g.projectId, (done.get(g.projectId) ?? 0) + 1);
  return projects.map((p) => ({ ...p, completedSections: done.get(p.id) ?? 0, totalSections: LAUNCH_SECTIONS.length }));
}

export async function getLaunchProject(user, workspaceId, projectId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const project = await findScopedProject(scope, projectId);
  const [active, versions] = await Promise.all([
    activeOutputs(project.id),
    prisma.projectOutput.findMany({ where: { projectId: project.id }, orderBy: [{ section: "asc" }, { version: "desc" }], select: versionSelect }),
  ]);
  const sections = Object.fromEntries(
    LAUNCH_SECTIONS.map((s) => {
      const output = active[s.key];
      return [
        s.key,
        {
          active: output ? { id: output.id, version: output.version, source: output.source, isAccepted: output.isAccepted, isMock: output.isMock, content: output.content, state: output.state, createdAt: output.createdAt } : null,
          versions: versions.filter((v) => v.section === s.key),
        },
      ];
    }),
  );
  return {
    id: project.id,
    workspaceId: project.workspaceId,
    name: project.name,
    status: project.status,
    input: project.input,
    business: project.business,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    permissions: { canEdit: scope.can(PERMISSIONS.BUSINESS_UPDATE), canGenerate: scope.can(PERMISSIONS.AI_GENERATE), canApprove: scope.can(PERMISSIONS.CONTEXT_APPROVE), canDelete: scope.can(PERMISSIONS.BUSINESS_DELETE) },
    sections,
  };
}

export async function updateLaunchProject(user, workspaceId, projectId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  await findScopedProject(scope, projectId);
  const updated = await prisma.project.update({ where: { id: projectId }, data: input, select: { id: true, name: true, status: true, input: true } });
  await recordAudit({ action: LAUNCH_AUDIT.PROJECT_UPDATED, actorId: user.id, workspaceId, entityType: "project", entityId: projectId, metadata: { fields: Object.keys(input) }, request });
  return updated;
}

export async function deleteLaunchProject(user, workspaceId, projectId, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_DELETE);
  await findScopedProject(scope, projectId);
  await prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
  await recordAudit({ action: LAUNCH_AUDIT.PROJECT_DELETED, actorId: user.id, workspaceId, entityType: "project", entityId: projectId, request });
}

// ── Sections ────────────────────────────────────────────────

async function createVersion(data, attempt = 0) {
  const last = await prisma.projectOutput.findFirst({ where: { projectId: data.projectId, section: data.section }, orderBy: { version: "desc" }, select: { version: true } });
  try {
    return await prisma.projectOutput.create({ data: { ...data, version: (last?.version ?? 0) + 1 } });
  } catch (error) {
    // Two concurrent saves picked the same version number: retry once.
    if (error?.code === "P2002" && attempt === 0) return createVersion(data, 1);
    throw error;
  }
}

function toVersion(row) {
  return { id: row.id, version: row.version, source: row.source, isAccepted: row.isAccepted, isMock: row.isMock, content: row.content, state: row.state, createdAt: row.createdAt };
}

export async function generateSection(user, workspaceId, projectId, section, { feedback } = {}, request) {
  assertSection(section);
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.AI_GENERATE);
  const project = await findScopedProject(scope, projectId);

  const uses = SECTION_BY_KEY[section].uses;
  const active = await activeOutputs(project.id, [...uses, section]);
  const previous = Object.fromEntries(uses.filter((k) => active[k]).map((k) => [k, active[k].content]));

  const result = await generateText({
    user,
    workspaceId,
    businessId: project.businessId,
    module: MODULE,
    task: section,
    instructions: buildInstructions(section),
    input: buildSectionInput({ input: project.input, previous, feedback, currentContent: active[section]?.content }),
    schema: SECTION_SCHEMAS[section],
    ...SECTION_AI_OPTIONS[section],
    request,
  });

  const output = await createVersion({
    projectId: project.id,
    section,
    source: "AI",
    content: result.data,
    isMock: result.isMock,
    feedback: feedback || null,
    generationId: result.generationId,
    createdById: user.id,
  });
  await prisma.project.update({ where: { id: project.id }, data: { updatedAt: new Date() } });
  await recordAudit({ action: LAUNCH_AUDIT.SECTION_GENERATED, actorId: user.id, workspaceId, entityType: "project_output", entityId: output.id, metadata: { section, version: output.version }, request });
  return toVersion(output);
}

export async function editSection(user, workspaceId, projectId, section, content, request) {
  assertSection(section);
  const parsed = SECTION_SCHEMAS[section].safeParse(content);
  if (!parsed.success) throw Errors.validation(flattenZodError(parsed.error));
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const project = await findScopedProject(scope, projectId);
  const output = await createVersion({ projectId: project.id, section, source: "EDIT", content: parsed.data, createdById: user.id });
  await recordAudit({ action: LAUNCH_AUDIT.SECTION_EDITED, actorId: user.id, workspaceId, entityType: "project_output", entityId: output.id, metadata: { section, version: output.version }, request });
  return toVersion(output);
}

export async function getSectionVersion(user, workspaceId, projectId, section, outputId) {
  assertSection(section);
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const project = await findScopedProject(scope, projectId);
  if (!uuidSchema.safeParse(outputId).success) throw Errors.notFound();
  const row = await prisma.projectOutput.findFirst({ where: { id: outputId, projectId: project.id, section } });
  if (!row) throw Errors.notFound();
  return toVersion(row);
}

export async function acceptSectionVersion(user, workspaceId, projectId, section, outputId, request) {
  assertSection(section);
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const project = await findScopedProject(scope, projectId);
  const row = await prisma.projectOutput.findFirst({ where: { id: outputId, projectId: project.id, section }, select: { id: true } });
  if (!row) throw Errors.notFound();
  await prisma.$transaction([
    prisma.projectOutput.updateMany({ where: { projectId: project.id, section, isAccepted: true }, data: { isAccepted: false } }),
    prisma.projectOutput.update({ where: { id: row.id }, data: { isAccepted: true } }),
  ]);
  await recordAudit({ action: LAUNCH_AUDIT.SECTION_ACCEPTED, actorId: user.id, workspaceId, entityType: "project_output", entityId: row.id, metadata: { section }, request });
  return { id: row.id, isAccepted: true };
}

/** Saves checklist progress on a specific checklist version (item ids are "category-item" indexes). */
export async function updateChecklistProgress(user, workspaceId, projectId, outputId, completed) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const project = await findScopedProject(scope, projectId);
  const row = await prisma.projectOutput.findFirst({ where: { id: outputId, projectId: project.id, section: "launch_checklist" } });
  if (!row) throw Errors.notFound();
  const valid = new Set(row.content.categories.flatMap((c, ci) => c.items.map((_, ii) => `${ci}-${ii}`)));
  const unknown = completed.filter((id) => !valid.has(id));
  if (unknown.length) throw new AppError("VALIDATION_ERROR", "Unknown checklist items.", 422, { completed: unknown });
  const state = { completed: [...new Set(completed)] };
  await prisma.projectOutput.update({ where: { id: row.id }, data: { state } });
  return { id: row.id, state, total: valid.size };
}

export async function exportLaunchPack(user, workspaceId, projectId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const project = await findScopedProject(scope, projectId);
  const outputs = await activeOutputs(project.id);
  return { filename: `${project.business.name.replace(/[^\w-]+/g, "-").toLowerCase() || "launch"}-launch-pack.md`, markdown: renderLaunchPackMarkdown({ project, business: project.business, outputs }) };
}

/** Active outputs for the profile builder (internal; caller must hold a scope). */
export async function getActiveLaunchContent(user, workspaceId, projectId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const project = await findScopedProject(scope, projectId);
  const active = await activeOutputs(project.id);
  return { project, content: Object.fromEntries(Object.entries(active).map(([k, v]) => [k, v.content])) };
}
