import { registerMockFixture } from "@/server/ai/providers/mock-fixtures.js";

/** Sample outputs for the TEST-ONLY mock AI provider (labelled "mock" in the UI). */
const T = "[Mock] ";
const FIXTURES = {
  personas: () => ({
    personas: [
      { name: "Commuter Chloe", segment: "Young professionals", ageRange: "25-34", occupation: "Office worker", location: "Leeds", bio: `${T}Buys breakfast on the way to work.`, goals: ["Quick healthy breakfast"], painPoints: ["Stale supermarket bread"], motivations: ["Quality"], objections: ["Price"], preferredChannels: ["Instagram"], buyingBehaviour: "Daily, impulse", quote: "I want real bread, fast." },
      { name: "Café Owner Omar", segment: "Local cafés", ageRange: "35-50", occupation: "Café owner", location: "Leeds", bio: `${T}Needs reliable supply.`, goals: ["Consistent quality"], painPoints: ["Late deliveries"], motivations: ["Reputation"], objections: ["Minimum orders"], preferredChannels: ["Email", "WhatsApp"], buyingBehaviour: "Weekly orders", quote: "Reliability matters most." },
    ],
  }),
  competitor_analysis: () => ({
    competitors: [{ name: "Supermarket bakeries", positioning: "Cheap and convenient", channels: ["In-store"], messaging: "Value", pricing: "Budget", strengths: ["Convenience"], weaknesses: ["Freshness"], opportunityForUs: `${T}Own freshness.` }],
    marketGaps: [`${T}Fresh sourdough delivered to cafés.`],
    positioningStatement: `${T}The freshest sourdough in the neighbourhood.`,
    disclaimer: `${T}Verify with local research.`,
  }),
  channels: () => ({
    channels: [
      { channel: "instagram", priority: "high", rationale: `${T}Visual product.`, audienceFit: "Young professionals", contentTypes: ["Reels"], effort: "medium", cost: "free" },
      { channel: "google_business_profile", priority: "high", rationale: `${T}Local search.`, audienceFit: "Locals", contentTypes: ["Photos"], effort: "low", cost: "free" },
      { channel: "email", priority: "medium", rationale: `${T}Café partners.`, audienceFit: "Cafés", contentTypes: ["Newsletters"], effort: "low", cost: "low" },
    ],
    channelsToAvoid: [{ channel: "Radio", reason: `${T}Too costly.` }],
  }),
  objectives: () => ({
    objectives: [{ title: "Grow local awareness", description: `${T}Reach locals.`, funnelStage: "awareness", metric: "Instagram followers", target: "1,000", timeframe: "3 months" }],
    campaigns: [{ name: "Opening week", objective: "Grow local awareness", audience: "Commuter Chloe", channels: ["Instagram"], keyMessage: `${T}Fresh bread is here.`, timing: "Launch month", durationWeeks: 2 }],
  }),
  budget: () => ({
    currency: "GBP",
    allocations: [
      { channel: "Instagram ads", monthlyAmount: 300, purpose: `${T}Local reach.` },
      { channel: "Google Business Profile", monthlyAmount: 0, purpose: `${T}Free listing.` },
      { channel: "Email", monthlyAmount: 50, purpose: `${T}Tooling.` },
      { channel: "Events", monthlyAmount: 150, purpose: `${T}Tastings.` },
    ],
    phasing: [{ period: "Q1", amount: 1800, focus: "Launch" }, { period: "Q2-Q4", amount: 4200, focus: "Growth" }],
    assumptions: [`${T}Prices are estimates.`],
    lowBudgetAlternatives: [`${T}Organic content only.`],
  }),
  advertising: () => ({
    platforms: [{ platform: "Instagram", adFormats: ["Reels"], targeting: "5 km radius, 25-44", bidStrategy: "Lowest cost", creativeGuidance: `${T}Show the bread.` }],
    messagingPillars: ["Freshness"],
    sampleAds: [{ platform: "Instagram", headline: "Still warm", primaryText: `${T}Sourdough baked at dawn.`, callToAction: "Visit us" }],
    testingPlan: [`${T}Test two hooks.`],
    complianceNotes: [`${T}Follow ASA rules.`],
  }),
  kpis: () => ({
    kpis: [
      { name: "Instagram reach", category: "awareness", definition: `${T}Unique accounts reached.`, formula: "Reach", target: "10k/month", frequency: "weekly", tool: "Instagram Insights" },
      { name: "Café accounts", category: "acquisition", definition: `${T}Active wholesale clients.`, formula: "Count", target: "5", frequency: "monthly", tool: "Spreadsheet" },
    ],
    reviewCadence: `${T}Weekly check, monthly review.`,
  }),
  strategy: () => ({
    executiveSummary: `${T}Win the neighbourhood, then the cafés.`,
    positioning: `${T}Freshest local sourdough.`,
    valueProposition: `${T}Real bread, nearby.`,
    targetSegments: ["Young professionals", "Local cafés"],
    messagingFramework: { coreMessage: `${T}Baked fresh, every morning.`, pillars: [{ pillar: "Freshness", proofPoints: ["Baked at dawn"] }] },
    funnelStrategy: [{ stage: "Awareness", goal: "Be known locally", tactics: ["Reels"] }],
    ninetyDayPlan: [{ period: "Weeks 1-2", actions: ["Set up profiles"] }],
    risks: [{ risk: "Low footfall", mitigation: "Café partnerships" }],
  }),
};

for (const [task, factory] of Object.entries(FIXTURES)) registerMockFixture("strategy", task, factory);
