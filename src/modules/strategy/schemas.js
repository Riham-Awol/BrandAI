import { z } from "zod";

/** Marketing Strategy Studio schemas (client + server). */

export const PRIMARY_GOALS = ["launch", "awareness", "leads", "sales", "retention"];
export const GOAL_LABELS = { launch: "Launch the business", awareness: "Build awareness", leads: "Generate leads", sales: "Increase sales", retention: "Retain & grow customers" };
export const CURRENCIES = ["USD", "EUR", "GBP", "KES", "NGN", "GHS", "ZAR", "EGP", "MAD", "INR", "PKR", "BDT", "IDR", "PHP", "MYR", "SGD", "AED", "SAR", "TRY", "BRL", "MXN", "CAD", "AUD", "JPY", "CNY"];

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

export const strategyInputSchema = z.object({
  primaryGoal: z.enum(PRIMARY_GOALS).default("awareness"),
  monthlyBudget: z.coerce.number().min(0).max(100_000_000).optional(),
  currency: z.enum(CURRENCIES).default("USD"),
  timeframeMonths: z.coerce.number().int().refine((v) => [3, 6, 12].includes(v), "Choose 3, 6 or 12 months.").default(6),
  focusMarkets: optionalText(500),
  constraints: optionalText(1000),
});

export const createStrategyProjectSchema = strategyInputSchema.extend({ businessId: z.uuid() });

const s = z.string();
const list = z.array(z.string());
const amount = z.number().describe("Amount in the plan currency (number only, no symbols).");

export const CHANNELS = [
  "instagram", "facebook", "tiktok", "linkedin", "x", "youtube", "pinterest", "whatsapp", "google_search_ads",
  "google_business_profile", "seo_website", "email", "influencers", "partnerships", "events", "pr", "print", "radio", "referral", "other",
];
const level = z.enum(["low", "medium", "high"]);

export const SECTION_SCHEMAS = {
  personas: z.object({
    personas: z.array(
      z.object({
        name: s.describe("A memorable persona name, e.g. 'Busy Professional Priya'."),
        segment: s,
        ageRange: s,
        occupation: s,
        location: s,
        bio: s,
        goals: list,
        painPoints: list,
        motivations: list,
        objections: list,
        preferredChannels: list,
        buyingBehaviour: s,
        quote: s.describe("Something this persona would plausibly say."),
      }),
    ),
  }),

  competitor_analysis: z.object({
    competitors: z.array(
      z.object({ name: s, positioning: s, channels: list, messaging: s, pricing: s, strengths: list, weaknesses: list, opportunityForUs: s }),
    ),
    marketGaps: list,
    positioningStatement: s,
    disclaimer: s,
  }),

  channels: z.object({
    channels: z.array(
      z.object({
        channel: z.enum(CHANNELS),
        priority: level,
        rationale: s,
        audienceFit: s,
        contentTypes: list,
        effort: level,
        cost: z.enum(["free", "low", "medium", "high"]),
      }),
    ),
    channelsToAvoid: z.array(z.object({ channel: s, reason: s })),
  }),

  objectives: z.object({
    objectives: z.array(
      z.object({
        title: s,
        description: s,
        funnelStage: z.enum(["awareness", "consideration", "conversion", "retention", "advocacy"]),
        metric: s,
        target: s,
        timeframe: s,
      }),
    ),
    campaigns: z.array(
      z.object({ name: s, objective: s, audience: s, channels: list, keyMessage: s, timing: s, durationWeeks: z.number() }),
    ),
  }),

  budget: z.object({
    currency: s.describe("ISO 4217 code, e.g. GBP."),
    allocations: z.array(z.object({ channel: s, monthlyAmount: amount, purpose: s })),
    phasing: z.array(z.object({ period: s, amount, focus: s })),
    assumptions: list,
    lowBudgetAlternatives: list,
  }),

  advertising: z.object({
    platforms: z.array(
      z.object({ platform: s, adFormats: list, targeting: s, bidStrategy: s, creativeGuidance: s }),
    ),
    messagingPillars: list,
    sampleAds: z.array(z.object({ platform: s, headline: s, primaryText: s, callToAction: s })),
    testingPlan: list,
    complianceNotes: list,
  }),

  kpis: z.object({
    kpis: z.array(
      z.object({
        name: s,
        category: z.enum(["awareness", "engagement", "acquisition", "conversion", "retention", "revenue"]),
        definition: s,
        formula: s,
        target: s,
        frequency: z.enum(["daily", "weekly", "monthly", "quarterly"]),
        tool: s,
      }),
    ),
    reviewCadence: s,
  }),

  strategy: z.object({
    executiveSummary: s,
    positioning: s,
    valueProposition: s,
    targetSegments: list,
    messagingFramework: z.object({ coreMessage: s, pillars: z.array(z.object({ pillar: s, proofPoints: list })) }),
    funnelStrategy: z.array(z.object({ stage: s, goal: s, tactics: list })),
    ninetyDayPlan: z.array(z.object({ period: s, actions: list })),
    risks: z.array(z.object({ risk: s, mitigation: s })),
  }),
};

export const SECTION_KEYS = Object.keys(SECTION_SCHEMAS);
