import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { AppError, Errors } from "@/server/errors.js";
import { recordAudit } from "@/server/audit/service.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { findScopedBusiness } from "@/server/businesses/service.js";
import { publishApprovedSections } from "@/server/businesses/context-service.js";
import { computeBudget } from "./budget.js";
import { budgetCsv, kpisCsv, renderPlanMarkdown } from "./export.js";
import { REQUIRED_FOR_APPROVAL, STRATEGY_SECTIONS, STRATEGY_SECTION_BY_KEY } from "./sections.js";
import { strategyEngine } from "./service.js";

/** Builds the plan from active outputs (pure apart from inputs). */
export function assemblePlan(active, project) {
  const missing = REQUIRED_FOR_APPROVAL.filter((s) => !active[s]).map((s) => STRATEGY_SECTION_BY_KEY[s].title);
  const sections = Object.fromEntries(STRATEGY_SECTIONS.map((s) => [s.key, active[s.key]?.content ?? null]));
  const budget = sections.budget ? computeBudget(sections.budget, { statedMonthly: project.input?.monthlyBudget }) : null;
  return { complete: missing.length === 0, missing, data: { businessName: project.business.name, settings: project.input, sections, budget } };
}

/** What other studios receive as `marketingPreferences`. */
export function planToContext(data) {
  const { sections, budget, settings } = data;
  return {
    marketingPreferences: {
      primaryGoal: settings?.primaryGoal,
      timeframeMonths: settings?.timeframeMonths,
      currency: budget?.currency ?? settings?.currency,
      monthlyBudget: budget?.totalMonthly,
      priorityChannels: sections.channels?.channels.filter((c) => c.priority === "high").map((c) => c.channel),
      otherChannels: sections.channels?.channels.filter((c) => c.priority !== "high").map((c) => c.channel),
      channelsToAvoid: sections.channels?.channelsToAvoid?.map((c) => c.channel),
      personas: sections.personas?.personas.map((p) => ({ name: p.name, segment: p.segment, goals: p.goals, painPoints: p.painPoints, preferredChannels: p.preferredChannels })),
      objectives: sections.objectives?.objectives.map((o) => ({ title: o.title, metric: o.metric, target: o.target, timeframe: o.timeframe })),
      kpis: sections.kpis?.kpis.map((k) => ({ name: k.name, target: k.target })),
      coreMessage: sections.strategy?.messagingFramework?.coreMessage,
      messagingPillars: sections.strategy?.messagingFramework?.pillars?.map((p) => p.pillar),
      positioning: sections.strategy?.positioning,
    },
  };
}

async function latestApproved(businessId) {
  return prisma.marketingPlan.findFirst({ where: { businessId, status: "APPROVED" }, orderBy: { version: "desc" } });
}

export async function getPlanOverview(user, workspaceId, projectId) {
  const { project, active } = await strategyEngine.getActiveContent(user, workspaceId, projectId);
  const approved = await latestApproved(project.businessId);
  return { draft: assemblePlan(active, project), approved: approved ? { id: approved.id, version: approved.version, approvedAt: approved.approvedAt, projectId: approved.projectId } : null };
}

export async function approvePlan(user, workspaceId, projectId, request) {
  const { project, active } = await strategyEngine.getActiveContent(user, workspaceId, projectId);
  await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.CONTEXT_APPROVE);
  const { complete, missing, data } = assemblePlan(active, project);
  if (!complete) throw new AppError("CONFLICT", `Generate these sections first: ${missing.join(", ")}.`, 409, { missing });

  const plan = await prisma.$transaction(async (tx) => {
    const last = await tx.marketingPlan.findFirst({ where: { businessId: project.businessId }, orderBy: { version: "desc" }, select: { version: true } });
    await tx.marketingPlan.updateMany({ where: { businessId: project.businessId, status: "APPROVED" }, data: { status: "SUPERSEDED" } });
    return tx.marketingPlan.create({
      data: { workspaceId: project.workspaceId, businessId: project.businessId, projectId: project.id, version: (last?.version ?? 0) + 1, data, createdById: user.id, approvedById: user.id },
    });
  });
  await publishApprovedSections(user, workspaceId, project.businessId, planToContext(data), request);
  await recordAudit({ action: "strategy.plan_approved", actorId: user.id, workspaceId, entityType: "marketing_plan", entityId: plan.id, metadata: { version: plan.version }, request });
  return { id: plan.id, version: plan.version };
}

export async function getCurrentPlan(user, workspaceId, businessId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const business = await findScopedBusiness(scope, businessId);
  const plan = await latestApproved(business.id);
  return { business, plan: plan ? { id: plan.id, version: plan.version, approvedAt: plan.approvedAt, projectId: plan.projectId, data: plan.data } : null };
}

/** Exports the current studio plan (draft or not) as Markdown or CSV. */
export async function exportPlan(user, workspaceId, projectId, format) {
  const { project, active } = await strategyEngine.getActiveContent(user, workspaceId, projectId);
  const { data } = assemblePlan(active, project);
  return renderExport(data, format);
}

/** Exports the business's approved plan. */
export async function exportApprovedPlan(user, workspaceId, businessId, format) {
  const { plan } = await getCurrentPlan(user, workspaceId, businessId);
  if (!plan) throw Errors.notFound("No approved marketing plan yet.");
  return renderExport(plan.data, format, plan.version);
}

function renderExport(data, format, version) {
  const slug = data.businessName.replace(/[^\w-]+/g, "-").toLowerCase() || "plan";
  if (format === "budget-csv") {
    if (!data.budget) throw Errors.notFound("Generate the budget first.");
    return { filename: `${slug}-marketing-budget.csv`, contentType: "text/csv; charset=utf-8", body: budgetCsv(data.budget) };
  }
  if (format === "kpis-csv") {
    if (!data.sections.kpis) throw Errors.notFound("Generate the KPIs first.");
    return { filename: `${slug}-kpis.csv`, contentType: "text/csv; charset=utf-8", body: kpisCsv(data.sections.kpis) };
  }
  return { filename: `${slug}-marketing-plan.md`, contentType: "text/markdown; charset=utf-8", body: renderPlanMarkdown(data, { version }) };
}
