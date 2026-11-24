/**
 * Launch Studio sections in guided order (client-safe metadata).
 * `uses` lists earlier sections whose current output is fed to the AI.
 */
export const LAUNCH_SECTIONS = [
  { key: "idea_analysis", title: "Idea analysis", short: "Analysis", description: "Viability, strengths, risks and the assumptions to test first.", uses: [] },
  { key: "names", title: "Business names", short: "Names", description: "Name ideas with taglines and the thinking behind them.", uses: ["idea_analysis"] },
  { key: "industry", title: "Industry classification", short: "Industry", description: "Your industry, market maturity and regulatory considerations.", uses: ["idea_analysis"] },
  { key: "audience", title: "Target audience", short: "Audience", description: "Customer segments, their needs and where to reach them.", uses: ["idea_analysis", "industry"] },
  { key: "problems", title: "Customer problems", short: "Problems", description: "The problems you solve and your core value proposition.", uses: ["idea_analysis", "audience"] },
  { key: "competitors", title: "Competitor research", short: "Competitors", description: "Likely competitors and where you can stand out.", uses: ["industry", "audience", "problems"] },
  { key: "business_model", title: "Business model", short: "Model", description: "How you make money, pricing and your offer.", uses: ["audience", "problems", "competitors"] },
  { key: "strategy", title: "Business strategy", short: "Strategy", description: "Positioning, goals, phased roadmap and risks.", uses: ["idea_analysis", "audience", "competitors", "business_model"] },
  { key: "business_plan", title: "Business plan", short: "Plan", description: "A complete, structured business plan.", uses: ["idea_analysis", "industry", "audience", "problems", "competitors", "business_model", "strategy"] },
  { key: "launch_checklist", title: "Launch checklist", short: "Checklist", description: "Actionable launch tasks you can tick off.", uses: ["industry", "business_model", "strategy"] },
];

export const SECTION_BY_KEY = Object.fromEntries(LAUNCH_SECTIONS.map((s) => [s.key, s]));

/** Pseudo-section for the profile builder step. */
export const PROFILE_STEP = { key: "profile", title: "Business profile", short: "Profile", description: "Turn your results into a reusable business profile." };
