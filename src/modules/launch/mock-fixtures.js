import { registerMockFixture } from "@/server/ai/providers/mock-fixtures.js";

/**
 * Sample outputs for the TEST-ONLY mock AI provider. They exist so automated
 * tests can drive the whole studio without a paid API. They are never used
 * when a real provider is configured, and are labelled "mock" in the UI.
 */
const T = "[Mock] ";

const FIXTURES = {
  idea_analysis: () => ({
    summary: `${T}A neighbourhood bakery concept with strong local demand signals.`,
    viabilityScore: 72,
    verdict: "promising",
    strengths: [`${T}Clear local demand`, `${T}Low technical risk`],
    weaknesses: [`${T}Thin margins`],
    opportunities: [`${T}Wholesale to cafés`],
    threats: [`${T}Rising ingredient costs`],
    keyAssumptions: [`${T}Customers will pay a premium for fresh bread`],
    recommendedNextSteps: [`${T}Run a weekend market stall test`],
  }),
  names: () => ({
    suggestions: [
      { name: "Crumb & Co", tagline: "Baked fresh, every morning", style: "compound", rationale: `${T}Warm and memorable.` },
      { name: "Morning Loaf", tagline: "Your daily bread", style: "descriptive", rationale: `${T}Says what it does.` },
    ],
    namingNotes: `${T}Check trademarks and domain availability before deciding.`,
  }),
  industry: () => ({
    primaryIndustry: "Food & Beverage",
    subIndustry: "Retail Bakery",
    sector: "Consumer",
    naicsCode: "311811",
    marketMaturity: "mature",
    relatedIndustries: ["Cafés", "Catering"],
    regulatoryConsiderations: [`${T}Food hygiene registration`],
    rationale: `${T}Sells baked goods directly to consumers.`,
  }),
  audience: () => ({
    summary: `${T}Local families and young professionals.`,
    segments: [
      { name: "Young professionals", priority: "primary", description: `${T}Commuters buying breakfast.`, demographics: "25-40, urban", psychographics: "Convenience-seeking", needs: ["Speed"], buyingTriggers: ["Morning commute"], whereToReach: ["Instagram"] },
    ],
  }),
  problems: () => ({
    coreValueProposition: `${T}Fresh artisan bread within walking distance.`,
    problems: [{ problem: `${T}Supermarket bread is stale`, whoFeelsIt: "Food lovers", severity: "medium", currentAlternatives: "Supermarkets", howWeSolve: "Baked every morning" }],
  }),
  competitors: () => ({
    disclaimer: `${T}Based on general knowledge; verify with current local research.`,
    competitors: [{ name: "Local supermarket bakeries", type: "indirect", description: `${T}In-store bakery counters.`, website: "", pricePositioning: "budget", strengths: ["Convenience"], weaknesses: ["Lower freshness"] }],
    differentiationOpportunities: [`${T}Sourdough specialisation`],
  }),
  business_model: () => ({
    recommended: { name: "Retail + wholesale", description: `${T}Shop sales plus café supply.`, revenueStreams: ["Retail sales", "Wholesale"], pricingStrategy: "Premium", costStructure: ["Ingredients", "Rent"], keyResources: ["Ovens"], channels: ["Shopfront"] },
    alternatives: [{ name: "Market stall", description: `${T}Weekend markets only.`, pros: ["Low cost"], cons: ["Limited hours"] }],
    productsAndServices: [
      { name: "Sourdough loaf", type: "product", description: `${T}48-hour fermented loaf.`, priceRange: "$6-$8" },
      { name: "Café supply", type: "service", description: `${T}Daily delivery to cafés.`, priceRange: "Contract" },
    ],
  }),
  strategy: () => ({
    positioning: `${T}The freshest bread in the neighbourhood.`,
    valueProposition: `${T}Artisan quality at your doorstep.`,
    goals: [{ title: "Break even", description: `${T}Cover monthly costs.`, timeframe: "Month 6", metric: "Monthly profit ≥ 0" }],
    phases: [{ name: "Launch", timeframe: "First 90 days", objectives: ["Open shop"], actions: ["Soft opening"] }],
    risks: [{ risk: "Low footfall", mitigation: "Wholesale contracts" }],
    keyMetrics: ["Daily sales"],
  }),
  business_plan: () => ({
    executiveSummary: `${T}A neighbourhood artisan bakery.`,
    companyDescription: `${T}Company description.`,
    marketAnalysis: `${T}Market analysis.`,
    productsAndServices: `${T}Products and services.`,
    marketingAndSales: `${T}Marketing and sales.`,
    operationsPlan: `${T}Operations plan.`,
    managementAndTeam: `${T}Management and team.`,
    financialPlan: { startupCosts: [{ item: "Ovens", estimate: "$8,000" }], revenueAssumptions: ["120 loaves/day"], breakEvenSummary: `${T}Month 7.` },
    fundingRequirements: `${T}$25,000 total.`,
    milestones: [{ milestone: "Opening day", targetDate: "Month 3" }],
  }),
  launch_checklist: () => ({
    categories: [
      { name: "Legal & registration", items: [{ task: "Register the business", description: `${T}Confirm with local authorities.`, priority: "high", timeframe: "Week 1" }, { task: "Food hygiene certificate", description: `${T}Required before trading.`, priority: "high", timeframe: "Week 2" }] },
      { name: "Marketing", items: [{ task: "Create Instagram account", description: `${T}Share daily bakes.`, priority: "medium", timeframe: "Before launch" }] },
    ],
  }),
};

for (const [task, factory] of Object.entries(FIXTURES)) registerMockFixture("launch", task, factory);
