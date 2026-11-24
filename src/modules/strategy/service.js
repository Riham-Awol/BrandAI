import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { recordAudit } from "@/server/audit/service.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { findScopedBusiness } from "@/server/businesses/service.js";
import { createStudioEngine } from "@/server/studio/engine.js";
import { SECTION_SCHEMAS } from "./schemas.js";
import { STRATEGY_SECTIONS } from "./sections.js";
import { STRATEGY_AI_OPTIONS, buildInstructions, buildStrategyInput } from "./prompts.js";
import "./mock-fixtures.js";

const round2 = (n) => Math.round(n * 100) / 100;

/** Normalizes numbers and codes so stored content is always consistent. */
export function postProcessStrategy(section, data) {
  if (section === "budget") {
    return {
      ...data,
      currency: String(data.currency).trim().toUpperCase().slice(0, 3),
      allocations: data.allocations.map((a) => ({ ...a, monthlyAmount: Math.max(0, round2(Number(a.monthlyAmount) || 0)) })),
      phasing: data.phasing.map((p) => ({ ...p, amount: Math.max(0, round2(Number(p.amount) || 0)) })),
    };
  }
  if (section === "objectives") {
    return { ...data, campaigns: data.campaigns.map((c) => ({ ...c, durationWeeks: Math.max(1, Math.min(104, Math.round(Number(c.durationWeeks) || 1))) })) };
  }
  return data;
}

export const strategyEngine = createStudioEngine({
  type: "STRATEGY_STUDIO",
  module: "strategy",
  sections: STRATEGY_SECTIONS,
  schemas: SECTION_SCHEMAS,
  aiOptions: STRATEGY_AI_OPTIONS,
  buildInstructions: (section) => buildInstructions(section),
  buildInput: buildStrategyInput,
  postProcess: postProcessStrategy,
});

export async function createStrategyProject(user, workspaceId, input, request) {
  const { businessId, ...settings } = input;
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const business = await findScopedBusiness(scope, businessId);
  const project = await prisma.project.create({
    data: { workspaceId: scope.workspaceId, businessId: business.id, type: "STRATEGY_STUDIO", name: `${business.name} marketing strategy`, input: settings, createdById: user.id },
    select: { id: true, name: true, businessId: true, createdAt: true },
  });
  await recordAudit({ action: "strategy.project_created", actorId: user.id, workspaceId, entityType: "project", entityId: project.id, request });
  return project;
}

export const listStrategyProjects = (user, workspaceId) => strategyEngine.listProjects(user, workspaceId);
