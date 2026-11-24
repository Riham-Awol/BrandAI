import { describe, expect, it } from "vitest";
import { computeBudget, formatMoney } from "@/modules/strategy/budget.js";
import { SECTION_KEYS, SECTION_SCHEMAS, createStrategyProjectSchema } from "@/modules/strategy/schemas.js";
import { STRATEGY_SECTIONS, REQUIRED_FOR_APPROVAL } from "@/modules/strategy/sections.js";
import { budgetCsv, kpisCsv, renderPlanMarkdown } from "@/modules/strategy/export.js";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import "@/modules/strategy/mock-fixtures.js";
import { postProcessStrategy } from "@/modules/strategy/service.js";
import { assemblePlan, planToContext } from "@/modules/strategy/plan-service.js";
import { toCsv } from "@/lib/markdown.js";

const fixture = (k) => postProcessStrategy(k, mockFixtureResponder({ module: "strategy", task: k }).data);

describe("strategy definitions", () => {
  it("keeps fixtures valid and sections ordered", () => {
    expect(STRATEGY_SECTIONS.map((s) => s.key)).toEqual(SECTION_KEYS);
    STRATEGY_SECTIONS.forEach((s, i) => s.uses.forEach((d) => expect(SECTION_KEYS.indexOf(d)).toBeLessThan(i)));
    for (const k of SECTION_KEYS) expect(SECTION_SCHEMAS[k].safeParse(fixture(k)).success, k).toBe(true);
    expect(REQUIRED_FOR_APPROVAL.every((k) => SECTION_KEYS.includes(k))).toBe(true);
  });
  it("validates plan settings", () => {
    const id = crypto.randomUUID();
    expect(createStrategyProjectSchema.parse({ businessId: id, monthlyBudget: "250" })).toMatchObject({ monthlyBudget: 250, currency: "USD", timeframeMonths: 6, primaryGoal: "awareness" });
    expect(createStrategyProjectSchema.safeParse({ businessId: id, timeframeMonths: 5 }).success).toBe(false);
    expect(createStrategyProjectSchema.safeParse({ businessId: id, currency: "XXX" }).success).toBe(false);
    expect(createStrategyProjectSchema.safeParse({ businessId: id, monthlyBudget: -1 }).success).toBe(false);
  });
});

describe("budget maths", () => {
  it("computes totals and shares from line items, never from AI totals", () => {
    const b = computeBudget({ currency: "gbp", allocations: [{ channel: "A", monthlyAmount: 300 }, { channel: "B", monthlyAmount: 100.005 }, { channel: "C", monthlyAmount: -5 }], phasing: [] });
    expect(b).toMatchObject({ currency: "GBP", totalMonthly: 400.01, totalFirstYear: 4800.12, overBudget: false });
    expect(b.allocations.map((a) => a.share)).toEqual([75, 25, 0]);
  });
  it("uses phasing for the first-year total and flags overspend beyond 5%", () => {
    expect(computeBudget({ allocations: [{ monthlyAmount: 100 }], phasing: [{ amount: 500 }, { amount: 700 }] }).totalFirstYear).toBe(1200);
    expect(computeBudget({ allocations: [{ monthlyAmount: 104 }] }, { statedMonthly: 100 }).overBudget).toBe(false);
    expect(computeBudget({ allocations: [{ monthlyAmount: 106 }] }, { statedMonthly: 100 }).overBudget).toBe(true);
    expect(computeBudget({ allocations: [] }).allocations).toEqual([]);
  });
  it("formats money, falling back for unknown currencies", () => {
    expect(formatMoney(1234.5, "GBP")).toBe("£1,235");
    expect(formatMoney(10, "??")).toBe("?? 10");
  });
});

describe("exports", () => {
  it("escapes CSV and neutralizes spreadsheet formulas", () => {
    expect(toCsv([["=SUM(A1)", "+1", "-2", "@x", "plain", 'a"b', "c,d"]])).toBe(`'=SUM(A1),'+1,'-2,'@x,plain,"a""b","c,d"\r\n`);
  });
  it("renders budget and KPI CSV and a full Markdown plan", () => {
    const budget = computeBudget(fixture("budget"), { statedMonthly: 500 });
    expect(budgetCsv(budget).split("\r\n").at(-2)).toBe("Total,500,100,");
    expect(kpisCsv(fixture("kpis"))).toContain("KPI,Category,Definition,Formula,Target,Frequency,Tool");
    const project = { business: { name: "Crust | Co" }, input: { primaryGoal: "launch", timeframeMonths: 6, currency: "GBP", monthlyBudget: 500 } };
    const active = Object.fromEntries(SECTION_KEYS.map((k) => [k, { content: fixture(k) }]));
    const { data, complete } = assemblePlan(active, project);
    expect(complete).toBe(true);
    const md = renderPlanMarkdown(data, { version: 3 });
    expect(md).toContain("# Crust \\| Co — Marketing Plan (v3)");
    expect(md.indexOf("## Marketing strategy")).toBeLessThan(md.indexOf("## Customer personas"));
    expect(md).toContain("| Instagram ads | £300 | 60% |");
  });
});

describe("plan → context", () => {
  it("summarizes the plan as marketingPreferences", () => {
    const project = { business: { name: "X" }, input: { primaryGoal: "sales", timeframeMonths: 12, currency: "GBP", monthlyBudget: 500 } };
    const active = Object.fromEntries(SECTION_KEYS.map((k) => [k, { content: fixture(k) }]));
    const ctx = planToContext(assemblePlan(active, project).data).marketingPreferences;
    expect(ctx).toMatchObject({ primaryGoal: "sales", monthlyBudget: 500, priorityChannels: ["instagram", "google_business_profile"], otherChannels: ["email"], channelsToAvoid: ["Radio"] });
    expect(ctx.personas[0]).toEqual(expect.objectContaining({ name: "Commuter Chloe" }));
    const partial = assemblePlan({ personas: active.personas }, project);
    expect(partial.complete).toBe(false);
    expect(partial.missing).toContain("Budget");
  });
});
