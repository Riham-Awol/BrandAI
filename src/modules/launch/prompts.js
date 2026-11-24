import "server-only";
import { BUDGET_LABELS } from "./schemas.js";
import { SECTION_BY_KEY } from "./sections.js";

const COMMON = [
  "You are helping an entrepreneur or business owner in Brand AI's Business Launch Studio.",
  "Be specific to the described business, location and budget; avoid generic filler.",
  "Use the currency and conventions of the stated country where relevant. Give realistic, conservative estimates and label them as estimates.",
  "Do not invent statistics, sources, URLs or company facts. When unsure, say so plainly.",
  "Write concise, professional English suitable for a global audience.",
].join(" ");

const TASK_INSTRUCTIONS = {
  idea_analysis: "Critically analyze the business idea. Score viability honestly (0-100). List 3-6 items per list.",
  names: "Suggest 8 distinctive, pronounceable business names suited to the audience and market, each with a short tagline. Avoid names of well-known existing brands.",
  industry: "Classify the business into its industry and explain the market context and the regulations to look into for the stated country.",
  audience: "Define 2-4 target customer segments (exactly one primary) with concrete, observable details.",
  problems: "Identify the 3-6 most important customer problems the business solves and how it solves each better than current alternatives.",
  competitors: "Identify 4-8 likely competitors (direct, indirect and substitutes) relevant to the stated location, from your general knowledge. Only include real companies you are confident exist; otherwise describe the competitor type generically (e.g. 'Local independent bakeries'). Leave website empty unless certain.",
  business_model: "Recommend the most suitable business model, 2 alternatives, and a starting set of 3-8 products/services with price ranges appropriate to the market.",
  strategy: "Create a practical launch-and-growth strategy: positioning, 3-5 SMART goals, 3 phases (e.g. first 90 days, months 4-12, year 2) and key risks with mitigations.",
  business_plan: "Write a complete business plan. Each narrative section should be 1-3 well-structured paragraphs. Startup costs must fit the stated budget, or explain the gap.",
  launch_checklist: "Create an actionable launch checklist of 20-35 tasks grouped into 4-7 categories (e.g. Legal & registration, Finance, Product, Marketing, Operations). Include country-specific registration steps in general terms and tell the user to confirm with local authorities.",
};

export function buildInstructions(section) {
  return `${COMMON}\n\nTask — ${SECTION_BY_KEY[section].title}: ${TASK_INSTRUCTIONS[section]}`;
}

/** Renders the user's idea input as stable text for the prompt. */
export function renderIdeaInput(input) {
  const lines = [
    `Idea: ${input.idea}`,
    input.businessName ? `Working business name: ${input.businessName}` : null,
    `Location: ${[input.city, input.country].filter(Boolean).join(", ")}`,
    `Stage: ${input.stage}`,
    `Budget: ${BUDGET_LABELS[input.budget] ?? input.budget}`,
    input.audienceHint ? `Intended customers: ${input.audienceHint}` : null,
    input.goals ? `Owner's goals: ${input.goals}` : null,
    input.experience ? `Owner's experience and resources: ${input.experience}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * Builds the user-input block: idea, earlier section outputs and optional
 * revision instructions. Everything here is treated as data by the model.
 */
export function buildSectionInput({ input, previous, feedback, currentContent }) {
  const parts = [`<idea>\n${renderIdeaInput(input)}\n</idea>`];
  for (const [key, content] of Object.entries(previous)) {
    parts.push(`<previous_result section="${key}">\n${JSON.stringify(content)}\n</previous_result>`);
  }
  if (feedback) {
    if (currentContent) parts.push(`<current_version>\n${JSON.stringify(currentContent)}\n</current_version>`);
    parts.push(`<revision_request>\n${feedback}\n</revision_request>\nRevise the current version according to the revision request.`);
  }
  return parts.join("\n\n");
}

export const SECTION_AI_OPTIONS = {
  idea_analysis: { effort: "medium", maxTokens: 8000 },
  names: { effort: "low", maxTokens: 6000 },
  industry: { effort: "low", maxTokens: 6000 },
  audience: { effort: "medium", maxTokens: 8000 },
  problems: { effort: "medium", maxTokens: 8000 },
  competitors: { effort: "medium", maxTokens: 8000 },
  business_model: { effort: "medium", maxTokens: 10000 },
  strategy: { effort: "medium", maxTokens: 12000 },
  business_plan: { effort: "medium", maxTokens: 16000 },
  launch_checklist: { effort: "low", maxTokens: 12000 },
};
