import "server-only";
import { CHANNELS, GOAL_LABELS } from "./schemas.js";
import { STRATEGY_SECTION_BY_KEY } from "./sections.js";

const COMMON = [
  "You are a senior marketing strategist in Brand AI's Marketing Strategy Studio.",
  "Base everything on the business context, brand identity and voice provided; be specific to the audience, location and budget.",
  "Prefer practical, affordable tactics for small businesses unless the budget clearly allows more. Use the plan currency for all amounts.",
  "Do not invent statistics, sources or competitor facts; label estimates as estimates. Write concise, professional English for a global audience.",
].join(" ");

const TASKS = {
  personas: "Create 3 distinct, realistic customer personas grounded in the target audience. Each needs concrete goals, pain points, motivations, objections, preferred channels and buying behaviour.",
  competitor_analysis: "Analyse 3-6 likely competitors from a marketing perspective (positioning, channels, messaging, pricing) from general knowledge only; include a disclaimer that it must be verified. Identify market gaps and write a positioning statement.",
  channels: `Recommend 5-8 marketing channels using ONLY these keys: ${CHANNELS.join(", ")}. Prioritize by audience fit, effort and cost for this budget. List channels to avoid with reasons.`,
  objectives: "Write 3-5 SMART objectives across the funnel and 2-4 campaigns that deliver them (with key message, channels, timing and duration in weeks).",
  budget: "Allocate the monthly marketing budget across the recommended channels (amounts as plain numbers in the plan currency; the allocations should add up to the stated monthly budget when one is given). Add a 12-month phasing (e.g. by quarter) whose amounts are totals per period, assumptions, and low-budget alternatives.",
  advertising: "Create the paid advertising strategy for the platforms that fit the budget: ad formats, targeting, bid strategy, creative guidance, messaging pillars, 3-6 sample ads in the brand voice, an A/B testing plan and compliance notes (e.g. platform ad policies, local advertising rules).",
  kpis: "Recommend 6-10 KPIs mapped to the objectives with definition, formula, realistic target, review frequency and a free or low-cost tool to measure it. Add a review cadence.",
  strategy: "Synthesize the complete marketing strategy: executive summary, positioning, value proposition, target segments, a messaging framework (core message + 3-4 pillars with proof points), funnel strategy (awareness → advocacy) and a 90-day action plan in 2-week periods, plus key risks with mitigations.",
};

export function buildInstructions(section) {
  return `${COMMON}\n\nTask — ${STRATEGY_SECTION_BY_KEY[section].title}: ${TASKS[section]}`;
}

export function buildStrategyInput({ project, previous, feedback, currentContent }) {
  const b = project.business;
  const i = project.input ?? {};
  const lines = [
    `<business>\nName: ${b.name}\nIndustry: ${b.industry ?? "not specified"}\nDescription: ${b.description ?? "not specified"}\nStage: ${b.stage}\n</business>`,
    `<plan_settings>\nPrimary goal: ${GOAL_LABELS[i.primaryGoal] ?? i.primaryGoal}\nMonthly marketing budget: ${i.monthlyBudget != null ? `${i.monthlyBudget} ${i.currency}` : `not set (suggest a realistic amount in ${i.currency})`}\nCurrency: ${i.currency}\nTimeframe: ${i.timeframeMonths} months\nFocus markets: ${i.focusMarkets ?? "as in the business context"}\nConstraints: ${i.constraints ?? "none stated"}\n</plan_settings>`,
  ];
  for (const [key, entry] of Object.entries(previous)) lines.push(`<previous_result section="${key}">\n${JSON.stringify(entry.content)}\n</previous_result>`);
  if (feedback) {
    if (currentContent) lines.push(`<current_version>\n${JSON.stringify(currentContent)}\n</current_version>`);
    lines.push(`<revision_request>\n${feedback}\n</revision_request>\nRevise the current version according to the revision request.`);
  }
  return lines.join("\n\n");
}

export const STRATEGY_AI_OPTIONS = {
  personas: { effort: "medium", maxTokens: 8000 },
  competitor_analysis: { effort: "medium", maxTokens: 8000 },
  channels: { effort: "medium", maxTokens: 6000 },
  objectives: { effort: "medium", maxTokens: 6000 },
  budget: { effort: "medium", maxTokens: 6000 },
  advertising: { effort: "medium", maxTokens: 8000 },
  kpis: { effort: "low", maxTokens: 6000 },
  strategy: { effort: "medium", maxTokens: 12000 },
};
