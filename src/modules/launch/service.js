import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { AppError, Errors } from "@/server/errors.js";
import { recordAudit } from "@/server/audit/service.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { findScopedBusiness } from "@/server/businesses/service.js";
import { createStudioEngine } from "@/server/studio/engine.js";
import { SECTION_SCHEMAS, checklistStateSchema } from "./schemas.js";
import { LAUNCH_SECTIONS } from "./sections.js";
import { buildInstructions, buildSectionInput, SECTION_AI_OPTIONS } from "./prompts.js";
import { renderLaunchPackMarkdown } from "./markdown.js";
import "./mock-fixtures.js";

export const LAUNCH_AUDIT = { PROJECT_CREATED: "launch.project_created" };

function checklistIds(content) {
  return new Set(content.categories.flatMap((c, ci) => c.items.map((_, ii) => `${ci}-${ii}`)));
}

const engine = createStudioEngine({
  type: "LAUNCH_STUDIO",
  module: "launch",
  sections: LAUNCH_SECTIONS,
  schemas: SECTION_SCHEMAS,
  aiOptions: SECTION_AI_OPTIONS,
  buildInstructions: (section) => buildInstructions(section),
  buildInput: ({ project, previous, feedback, currentContent }) =>
    buildSectionInput({
      input: project.input,
      previous: Object.fromEntries(Object.entries(previous).map(([k, v]) => [k, v.content])),
      feedback,
      currentContent,
    }),
  validateState: (section, state, content) => {
    if (section !== "launch_checklist") throw Errors.validation({ state: ["This section has no editable state."] });
    const parsed = checklistStateSchema.safeParse(state);
    if (!parsed.success) throw Errors.validation({ completed: ["Invalid checklist items."] });
    const valid = checklistIds(content);
    const unknown = parsed.data.completed.filter((id) => !valid.has(id));
    if (unknown.length) throw new AppError("VALIDATION_ERROR", "Unknown checklist items.", 422, { completed: unknown });
    return { completed: [...new Set(parsed.data.completed)] };
  },
});

export const launchEngine = engine;

export async function createLaunchProject(user, workspaceId, input, request) {
  const { businessId, ...idea } = input;
  const scope = await requireWorkspaceAccess(user, workspaceId, businessId ? PERMISSIONS.BUSINESS_UPDATE : PERMISSIONS.BUSINESS_CREATE);
  const existing = businessId ? await findScopedBusiness(scope, businessId) : null;

  const project = await prisma.$transaction(async (tx) => {
    const business =
      existing ??
      (await tx.business.create({
        data: { workspaceId: scope.workspaceId, name: idea.businessName || "Untitled business", description: idea.idea, stage: idea.stage, createdById: user.id },
      }));
    return tx.project.create({
      data: { workspaceId: scope.workspaceId, businessId: business.id, type: "LAUNCH_STUDIO", name: `${business.name} launch plan`, input: idea, createdById: user.id },
      select: { id: true, name: true, businessId: true, createdAt: true },
    });
  });
  await recordAudit({ action: LAUNCH_AUDIT.PROJECT_CREATED, actorId: user.id, workspaceId, entityType: "project", entityId: project.id, request });
  return project;
}

export const listLaunchProjects = (user, workspaceId) => engine.listProjects(user, workspaceId);
export const getLaunchProject = engine.getProject;
export const updateLaunchProject = engine.updateProject;
export const deleteLaunchProject = engine.deleteProject;
export const generateSection = engine.generateSection;
export const editSection = engine.editSection;
export const getSectionVersion = engine.getSectionVersion;
export const acceptSectionVersion = engine.acceptSectionVersion;

/** Saves checklist progress on a specific checklist version. */
export async function updateChecklistProgress(user, workspaceId, projectId, outputId, completed) {
  const { id, state } = await engine.updateSectionState(user, workspaceId, projectId, "launch_checklist", outputId, { completed });
  const row = await prisma.projectOutput.findUnique({ where: { id }, select: { content: true } });
  return { id, state, total: checklistIds(row.content).size };
}

export async function exportLaunchPack(user, workspaceId, projectId) {
  const { project, active } = await engine.getActiveContent(user, workspaceId, projectId);
  return {
    filename: `${project.business.name.replace(/[^\w-]+/g, "-").toLowerCase() || "launch"}-launch-pack.md`,
    markdown: renderLaunchPackMarkdown({ project, business: project.business, outputs: active }),
  };
}

/** Active content for the profile builder. */
export async function getActiveLaunchContent(user, workspaceId, projectId) {
  const { project, active } = await engine.getActiveContent(user, workspaceId, projectId);
  return { project, content: Object.fromEntries(Object.entries(active).map(([k, v]) => [k, v.content])) };
}
