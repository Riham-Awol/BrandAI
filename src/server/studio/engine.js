import "server-only";
import { prisma } from "../db/prisma.js";
import { AppError, Errors } from "../errors.js";
import { recordAudit } from "../audit/service.js";
import { generateText } from "../ai/orchestrator.js";
import { requireWorkspaceAccess } from "../permissions/authorize.js";
import { PERMISSIONS } from "../permissions/roles.js";
import { flattenZodError, uuidSchema } from "@/validation/common.js";

/**
 * Generic engine for AI studios built on `projects` + `project_outputs`.
 *
 * A studio supplies its project type, ordered sections (with the earlier
 * sections each one `uses`), Zod output schemas, prompt builders and optional
 * post-processing / state validation. The engine provides authorization,
 * workspace scoping, versioned generation, edits, acceptance, per-version
 * state (selections, checklist progress) and audit logging.
 */
export function createStudioEngine(config) {
  const { type, module, sections, schemas, buildInstructions, buildInput, aiOptions = {}, postProcess, validateState } = config;
  const byKey = Object.fromEntries(sections.map((s) => [s.key, s]));
  const versionSelect = { id: true, section: true, version: true, source: true, isAccepted: true, isMock: true, feedback: true, createdAt: true };
  const audit = (suffix) => `${module}.${suffix}`;

  function assertSection(section) {
    if (!byKey[section]) throw Errors.notFound();
  }

  async function findScopedProject(scope, projectId) {
    if (!uuidSchema.safeParse(projectId).success) throw Errors.notFound();
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId: scope.workspaceId, type, deletedAt: null, business: { deletedAt: null } },
      include: { business: { select: { id: true, name: true, industry: true, description: true, stage: true, status: true } } },
    });
    if (!project) throw Errors.notFound();
    return project;
  }

  /** Accepted version if one exists, otherwise the latest — per section. */
  async function activeOutputs(projectId, keys) {
    const rows = await prisma.projectOutput.findMany({
      where: { projectId, ...(keys ? { section: { in: keys } } : {}) },
      orderBy: [{ section: "asc" }, { version: "desc" }],
    });
    const active = {};
    for (const row of rows) {
      const current = active[row.section];
      if (!current || (row.isAccepted && !current.isAccepted)) active[row.section] = row;
    }
    return active;
  }

  function toVersion(row) {
    return { id: row.id, version: row.version, source: row.source, isAccepted: row.isAccepted, isMock: row.isMock, content: row.content, state: row.state, createdAt: row.createdAt };
  }

  async function createVersion(data, attempt = 0) {
    const last = await prisma.projectOutput.findFirst({ where: { projectId: data.projectId, section: data.section }, orderBy: { version: "desc" }, select: { version: true } });
    try {
      return await prisma.projectOutput.create({ data: { ...data, version: (last?.version ?? 0) + 1 } });
    } catch (error) {
      if (error?.code === "P2002" && attempt === 0) return createVersion(data, 1);
      throw error;
    }
  }

  function processContent(section, content) {
    const parsed = schemas[section].safeParse(content);
    if (!parsed.success) throw Errors.validation(flattenZodError(parsed.error));
    return postProcess ? postProcess(section, parsed.data) : parsed.data;
  }

  function checkState(section, state, content) {
    if (state == null) return null;
    if (!validateState) throw Errors.validation({ state: ["This section has no editable state."] });
    return validateState(section, state, content);
  }

  async function listProjects(user, workspaceId, { businessId } = {}) {
    const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
    const projects = await prisma.project.findMany({
      where: { workspaceId: scope.workspaceId, type, deletedAt: null, business: { deletedAt: null }, ...(businessId ? { businessId } : {}) },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, status: true, createdAt: true, updatedAt: true, business: { select: { id: true, name: true, stage: true } } },
    });
    if (projects.length === 0) return [];
    const groups = await prisma.projectOutput.groupBy({ by: ["projectId", "section"], where: { projectId: { in: projects.map((p) => p.id) } } });
    const done = new Map();
    for (const g of groups) if (byKey[g.section]) done.set(g.projectId, (done.get(g.projectId) ?? 0) + 1);
    return projects.map((p) => ({ ...p, completedSections: done.get(p.id) ?? 0, totalSections: sections.length }));
  }

  async function getProject(user, workspaceId, projectId) {
    const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
    const project = await findScopedProject(scope, projectId);
    const [active, versions] = await Promise.all([
      activeOutputs(project.id),
      prisma.projectOutput.findMany({ where: { projectId: project.id }, orderBy: [{ section: "asc" }, { version: "desc" }], select: versionSelect }),
    ]);
    return {
      id: project.id,
      workspaceId: project.workspaceId,
      name: project.name,
      status: project.status,
      input: project.input,
      business: project.business,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      permissions: {
        canEdit: scope.can(PERMISSIONS.BUSINESS_UPDATE),
        canGenerate: scope.can(PERMISSIONS.AI_GENERATE),
        canApprove: scope.can(PERMISSIONS.CONTEXT_APPROVE),
        canDelete: scope.can(PERMISSIONS.BUSINESS_DELETE),
      },
      sections: Object.fromEntries(
        sections.map((s) => [s.key, { active: active[s.key] ? toVersion(active[s.key]) : null, versions: versions.filter((v) => v.section === s.key) }]),
      ),
    };
  }

  async function updateProject(user, workspaceId, projectId, input, request) {
    const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
    await findScopedProject(scope, projectId);
    const updated = await prisma.project.update({ where: { id: projectId }, data: input, select: { id: true, name: true, status: true, input: true } });
    await recordAudit({ action: audit("project_updated"), actorId: user.id, workspaceId, entityType: "project", entityId: projectId, metadata: { fields: Object.keys(input) }, request });
    return updated;
  }

  async function deleteProject(user, workspaceId, projectId, request) {
    const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_DELETE);
    await findScopedProject(scope, projectId);
    await prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
    await recordAudit({ action: audit("project_deleted"), actorId: user.id, workspaceId, entityType: "project", entityId: projectId, request });
  }

  async function generateSection(user, workspaceId, projectId, section, { feedback } = {}, request) {
    assertSection(section);
    const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.AI_GENERATE);
    const project = await findScopedProject(scope, projectId);
    const uses = byKey[section].uses ?? [];
    const active = await activeOutputs(project.id, [...uses, section]);
    const previous = Object.fromEntries(uses.filter((k) => active[k]).map((k) => [k, { content: active[k].content, state: active[k].state }]));

    const result = await generateText({
      user,
      workspaceId,
      businessId: project.businessId,
      module,
      task: section,
      instructions: buildInstructions(section, project),
      input: buildInput({ section, project, previous, feedback, currentContent: active[section]?.content }),
      schema: schemas[section],
      ...aiOptions[section],
      request,
    });

    let content;
    try {
      content = postProcess ? postProcess(section, result.data) : result.data;
    } catch (error) {
      if (error instanceof AppError && error.code === "VALIDATION_ERROR") {
        throw new AppError("AI_INVALID_OUTPUT", "The AI returned an unexpected format. Please try again.", 502);
      }
      throw error;
    }

    const output = await createVersion({
      projectId: project.id, section, source: "AI", content, isMock: result.isMock,
      feedback: feedback || null, generationId: result.generationId, createdById: user.id,
    });
    await prisma.project.update({ where: { id: project.id }, data: { updatedAt: new Date() } });
    await recordAudit({ action: audit("section_generated"), actorId: user.id, workspaceId, entityType: "project_output", entityId: output.id, metadata: { section, version: output.version }, request });
    return toVersion(output);
  }

  async function editSection(user, workspaceId, projectId, section, content, request, { state } = {}) {
    assertSection(section);
    const processed = processContent(section, content);
    const checkedState = checkState(section, state, processed);
    const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
    const project = await findScopedProject(scope, projectId);
    const output = await createVersion({ projectId: project.id, section, source: "EDIT", content: processed, state: checkedState ?? undefined, createdById: user.id });
    await recordAudit({ action: audit("section_edited"), actorId: user.id, workspaceId, entityType: "project_output", entityId: output.id, metadata: { section, version: output.version }, request });
    return toVersion(output);
  }

  async function getSectionVersion(user, workspaceId, projectId, section, outputId) {
    assertSection(section);
    const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
    const project = await findScopedProject(scope, projectId);
    if (!uuidSchema.safeParse(outputId).success) throw Errors.notFound();
    const row = await prisma.projectOutput.findFirst({ where: { id: outputId, projectId: project.id, section } });
    if (!row) throw Errors.notFound();
    return toVersion(row);
  }

  async function acceptSectionVersion(user, workspaceId, projectId, section, outputId, request) {
    assertSection(section);
    const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
    const project = await findScopedProject(scope, projectId);
    if (!uuidSchema.safeParse(outputId).success) throw Errors.notFound();
    const row = await prisma.projectOutput.findFirst({ where: { id: outputId, projectId: project.id, section }, select: { id: true } });
    if (!row) throw Errors.notFound();
    await prisma.$transaction([
      prisma.projectOutput.updateMany({ where: { projectId: project.id, section, isAccepted: true }, data: { isAccepted: false } }),
      prisma.projectOutput.update({ where: { id: row.id }, data: { isAccepted: true } }),
    ]);
    await recordAudit({ action: audit("section_accepted"), actorId: user.id, workspaceId, entityType: "project_output", entityId: row.id, metadata: { section }, request });
    return { id: row.id, isAccepted: true };
  }

  /** Saves user state (e.g. a selection or checklist ticks) on one specific version. */
  async function updateSectionState(user, workspaceId, projectId, section, outputId, state) {
    assertSection(section);
    const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
    const project = await findScopedProject(scope, projectId);
    if (!uuidSchema.safeParse(outputId).success) throw Errors.notFound();
    const row = await prisma.projectOutput.findFirst({ where: { id: outputId, projectId: project.id, section } });
    if (!row) throw Errors.notFound();
    const checked = checkState(section, state, row.content);
    await prisma.projectOutput.update({ where: { id: row.id }, data: { state: checked } });
    return { id: row.id, state: checked };
  }

  /** Active outputs (content + state) for internal consumers holding a project id. */
  async function getActiveContent(user, workspaceId, projectId) {
    const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
    const project = await findScopedProject(scope, projectId);
    const active = await activeOutputs(project.id);
    return { scope, project, active };
  }

  return {
    type, module, sections, byKey,
    findScopedProject, activeOutputs, listProjects, getProject, updateProject, deleteProject,
    generateSection, editSection, getSectionVersion, acceptSectionVersion, updateSectionState, getActiveContent,
  };
}
