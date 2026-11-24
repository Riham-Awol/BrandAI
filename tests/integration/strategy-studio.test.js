import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma.js";
import { setProviderOverrides } from "@/server/ai/providers/registry.js";
import { createMockTextProvider } from "@/server/ai/providers/mock.js";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import { createBusiness } from "@/server/businesses/service.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { approveContextDraft, getApprovedContext } from "@/server/businesses/context-service.js";
import { saveBusinessProfile } from "@/server/businesses/profile-service.js";
import { businessProfileSchema } from "@/validation/profile.js";
import { createStrategyProject, listStrategyProjects, strategyEngine } from "@/modules/strategy/service.js";
import { approvePlan, exportApprovedPlan, exportPlan, getCurrentPlan, getPlanOverview } from "@/modules/strategy/plan-service.js";
import { STRATEGY_SECTIONS } from "@/modules/strategy/sections.js";
import { addMember, createUser } from "../helpers/factories.js";

let prompts;
beforeEach(() => {
  prompts = [];
  setProviderOverrides({ text: createMockTextProvider({ responder: (req) => (prompts.push(req), mockFixtureResponder(req)) }) });
});
afterEach(() => setProviderOverrides(null));

async function setup(settings = {}) {
  const owner = await createUser();
  const biz = await createBusiness(owner.user, owner.workspace.id, { name: "Crust & Culture", industry: "Bakery", stage: "STARTING" });
  const project = await createStrategyProject(owner.user, owner.workspace.id, { businessId: biz.id, primaryGoal: "launch", monthlyBudget: 500, currency: "GBP", timeframeMonths: 6, ...settings });
  return { owner, biz, project, ws: owner.workspace.id };
}
const gen = (ctx, section, opts) => strategyEngine.generateSection(ctx.owner.user, ctx.ws, ctx.project.id, section, opts);
const generateAll = async (ctx) => {
  for (const s of STRATEGY_SECTIONS) await gen(ctx, s.key);
};

describe("strategy projects and generation", () => {
  it("passes plan settings and earlier results into prompts", async () => {
    const ctx = await setup({ focusMarkets: "Leeds city centre" });
    await generateAll(ctx);
    const budgetPrompt = prompts.find((p) => p.task === "budget").prompt;
    expect(budgetPrompt).toContain("Monthly marketing budget: 500 GBP");
    expect(budgetPrompt).toContain("Primary goal: Launch the business");
    expect(budgetPrompt).toContain('<previous_result section="channels">');
    expect(prompts.find((p) => p.task === "strategy").prompt).toContain('<previous_result section="kpis">');
    expect(prompts.find((p) => p.task === "personas").prompt).toContain("Focus markets: Leeds city centre");
    expect((await listStrategyProjects(ctx.owner.user, ctx.ws))[0]).toMatchObject({ completedSections: 8, totalSections: 8 });
  });

  it("normalizes budget numbers and rejects invalid edits", async () => {
    const ctx = await setup();
    const out = await gen(ctx, "budget");
    const edited = await strategyEngine.editSection(ctx.owner.user, ctx.ws, ctx.project.id, "budget", {
      ...out.content, currency: "gbp", allocations: [{ channel: "Ads", monthlyAmount: -40, purpose: "x" }, { channel: "Events", monthlyAmount: 120.456, purpose: "y" }],
    });
    expect(edited.content.currency).toBe("GBP");
    expect(edited.content.allocations.map((a) => a.monthlyAmount)).toEqual([0, 120.46]);
    await expect(strategyEngine.editSection(ctx.owner.user, ctx.ws, ctx.project.id, "budget", { ...out.content, allocations: "lots" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects channels outside the allowed list", async () => {
    const ctx = await setup();
    setProviderOverrides({ text: createMockTextProvider({ responder: (req) => { const d = mockFixtureResponder(req).data; d.channels[0].channel = "carrier_pigeon"; return { data: d }; } }) });
    await expect(gen(ctx, "channels")).rejects.toMatchObject({ code: "AI_INVALID_OUTPUT" });
  });
});

describe("marketing plan approval", () => {
  it("computes the budget, approves versions and publishes marketingPreferences without losing other context", async () => {
    const ctx = await setup();
    await saveBusinessProfile(ctx.owner.user, ctx.ws, ctx.biz.id, businessProfileSchema.parse({ name: "Crust & Culture", stage: "STARTING" }));
    await approveContextDraft(ctx.owner.user, ctx.ws, ctx.biz.id, { sections: ["basics"] });
    await generateAll(ctx);

    const { draft } = await getPlanOverview(ctx.owner.user, ctx.ws, ctx.project.id);
    expect(draft.complete).toBe(true);
    expect(draft.data.budget).toMatchObject({ currency: "GBP", totalMonthly: 500, totalFirstYear: 6000, overBudget: false });
    expect(draft.data.budget.allocations.map((a) => a.share)).toEqual([60, 0, 10, 30]);

    const v1 = await approvePlan(ctx.owner.user, ctx.ws, ctx.project.id);
    const v2 = await approvePlan(ctx.owner.user, ctx.ws, ctx.project.id);
    expect([v1.version, v2.version]).toEqual([1, 2]);
    expect(await prisma.marketingPlan.count({ where: { businessId: ctx.biz.id, status: "APPROVED" } })).toBe(1);

    const scope = await requireWorkspaceAccess(ctx.owner.user, ctx.ws);
    const context = await getApprovedContext(scope, ctx.biz.id);
    expect(Object.keys(context.data).sort()).toEqual(["basics", "marketingPreferences"]);
    expect(context.data.marketingPreferences).toMatchObject({ primaryGoal: "launch", monthlyBudget: 500, currency: "GBP", priorityChannels: ["instagram", "google_business_profile"], coreMessage: expect.stringContaining("Baked fresh") });

    const current = await getCurrentPlan(ctx.owner.user, ctx.ws, ctx.biz.id);
    expect(current.plan.version).toBe(2);
  });

  it("flags plans that exceed the stated budget", async () => {
    const ctx = await setup({ monthlyBudget: 200 });
    await gen(ctx, "budget");
    const { draft } = await getPlanOverview(ctx.owner.user, ctx.ws, ctx.project.id);
    expect(draft.data.budget.overBudget).toBe(true);
  });

  it("refuses incomplete plans and non-admin approvers", async () => {
    const ctx = await setup();
    await gen(ctx, "personas");
    await expect(approvePlan(ctx.owner.user, ctx.ws, ctx.project.id)).rejects.toMatchObject({ code: "CONFLICT", details: { missing: expect.arrayContaining(["Budget", "KPIs"]) } });
    await generateAll(ctx);
    const editor = await createUser();
    await addMember(ctx.ws, editor.user.id, "EDITOR");
    await expect(approvePlan(editor.user, ctx.ws, ctx.project.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("exports", () => {
  it("exports Markdown and CSV, protecting spreadsheets from formula injection", async () => {
    const ctx = await setup();
    await generateAll(ctx);
    const out = (await strategyEngine.getProject(ctx.owner.user, ctx.ws, ctx.project.id)).sections.budget.active;
    await strategyEngine.editSection(ctx.owner.user, ctx.ws, ctx.project.id, "budget", { ...out.content, allocations: [{ channel: "=HYPERLINK(\"http://x\")", monthlyAmount: 10, purpose: "a, \"quoted\"" }] });

    const md = await exportPlan(ctx.owner.user, ctx.ws, ctx.project.id, "markdown");
    expect(md.filename).toBe("crust-culture-marketing-plan.md");
    expect(md.body).toContain("# Crust & Culture — Marketing Plan");
    expect(md.body).toContain("## Marketing strategy");
    expect(md.body).toContain("| Channel | Monthly | Share | Purpose |");

    const csv = await exportPlan(ctx.owner.user, ctx.ws, ctx.project.id, "budget-csv");
    expect(csv.body.split("\r\n")[1]).toBe(`"'=HYPERLINK(""http://x"")",10,100,"a, ""quoted"""`);
    const kpis = await exportPlan(ctx.owner.user, ctx.ws, ctx.project.id, "kpis-csv");
    expect(kpis.body).toContain("Instagram reach,awareness");

    await expect(exportApprovedPlan(ctx.owner.user, ctx.ws, ctx.biz.id, "markdown")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await approvePlan(ctx.owner.user, ctx.ws, ctx.project.id);
    expect((await exportApprovedPlan(ctx.owner.user, ctx.ws, ctx.biz.id, "markdown")).body).toContain("Marketing Plan (v1)");
  });
});

describe("isolation", () => {
  it("hides strategy projects and plans from other workspaces and blocks viewers from generating", async () => {
    const ctx = await setup();
    await generateAll(ctx);
    await approvePlan(ctx.owner.user, ctx.ws, ctx.project.id);
    const other = await createUser();
    await expect(strategyEngine.getProject(other.user, other.workspace.id, ctx.project.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getCurrentPlan(other.user, other.workspace.id, ctx.biz.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(exportPlan(other.user, other.workspace.id, ctx.project.id, "markdown")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createStrategyProject(other.user, other.workspace.id, { businessId: ctx.biz.id, currency: "USD", timeframeMonths: 6, primaryGoal: "sales" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const viewer = await createUser();
    await addMember(ctx.ws, viewer.user.id, "VIEWER");
    await expect(gen({ ...ctx, owner: viewer }, "personas")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
