/** Marketing Strategy Studio sections in guided order (client-safe). */
export const STRATEGY_SECTIONS = [
  { key: "personas", title: "Customer personas", short: "Personas", description: "Detailed people your marketing speaks to.", uses: [] },
  { key: "competitor_analysis", title: "Competitor analysis", short: "Competitors", description: "How competitors market themselves and where the gaps are.", uses: ["personas"] },
  { key: "channels", title: "Marketing channels", short: "Channels", description: "Where to show up, prioritized by fit, effort and cost.", uses: ["personas", "competitor_analysis"] },
  { key: "objectives", title: "Campaign objectives", short: "Objectives", description: "SMART objectives and the campaigns that deliver them.", uses: ["personas", "channels"] },
  { key: "budget", title: "Budget", short: "Budget", description: "Monthly allocation by channel, phasing and lean alternatives.", uses: ["channels", "objectives"] },
  { key: "advertising", title: "Advertising strategy", short: "Ads", description: "Paid platforms, targeting, creative and sample ads.", uses: ["personas", "channels", "budget"] },
  { key: "kpis", title: "KPIs", short: "KPIs", description: "What to measure, how, and the targets to aim for.", uses: ["objectives", "channels", "budget"] },
  { key: "strategy", title: "Marketing strategy", short: "Strategy", description: "The complete strategy: positioning, messaging, funnel and 90-day plan.", uses: ["personas", "competitor_analysis", "channels", "objectives", "budget", "advertising", "kpis"] },
];

export const STRATEGY_SECTION_BY_KEY = Object.fromEntries(STRATEGY_SECTIONS.map((s) => [s.key, s]));
export const PLAN_STEP = { key: "plan", title: "Review & approve", short: "Approve", description: "Approve your marketing plan for reuse across Brand AI." };
export const REQUIRED_FOR_APPROVAL = ["personas", "channels", "objectives", "budget", "kpis", "strategy"];
