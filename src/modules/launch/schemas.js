import { z } from "zod";

/**
 * Launch Studio input and output schemas (shared by client and server).
 *
 * Output schemas are sent to the AI as structured-output formats and every
 * response and every user edit is validated against them. They intentionally
 * avoid length constraints the model cannot reliably satisfy.
 */

export const BUDGET_RANGES = ["under_1k", "1k_10k", "10k_50k", "50k_250k", "over_250k", "not_sure"];
export const BUDGET_LABELS = {
  under_1k: "Under $1,000",
  "1k_10k": "$1,000 – $10,000",
  "10k_50k": "$10,000 – $50,000",
  "50k_250k": "$50,000 – $250,000",
  over_250k: "Over $250,000",
  not_sure: "Not sure yet",
};

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

export const ideaInputSchema = z.object({
  idea: z.string().trim().min(20, "Describe your idea in at least 20 characters.").max(4000),
  businessName: optionalText(160),
  country: z.string().trim().min(2, "Enter a country.").max(120),
  city: optionalText(120),
  stage: z.enum(["IDEA", "STARTING", "OPERATING", "ESTABLISHED"]).default("IDEA"),
  budget: z.enum(BUDGET_RANGES).default("not_sure"),
  audienceHint: optionalText(1000),
  goals: optionalText(1000),
  experience: optionalText(1000),
});

export const createLaunchProjectSchema = ideaInputSchema.extend({
  // "" (no existing business selected) means "create a new business".
  businessId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
});

export const updateLaunchProjectSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  input: ideaInputSchema.optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
});

const s = z.string();
const list = z.array(z.string());

export const SECTION_SCHEMAS = {
  idea_analysis: z.object({
    summary: s.describe("Two to four sentences summarizing the idea and its potential."),
    viabilityScore: z.number().describe("Overall viability from 0 to 100."),
    verdict: z.enum(["strong", "promising", "needs_work", "risky"]),
    strengths: list,
    weaknesses: list,
    opportunities: list,
    threats: list,
    keyAssumptions: list.describe("Assumptions that must be validated before investing heavily."),
    recommendedNextSteps: list,
  }),

  names: z.object({
    suggestions: z.array(
      z.object({
        name: s,
        tagline: s,
        style: z.enum(["descriptive", "abstract", "compound", "evocative", "acronym", "founder"]),
        rationale: s,
      }),
    ),
    namingNotes: s.describe("Advice on checking trademarks, domains and cultural fit in the target markets."),
  }),

  industry: z.object({
    primaryIndustry: s,
    subIndustry: s,
    sector: s,
    naicsCode: s.describe("Closest NAICS code, or empty string if unsure."),
    marketMaturity: z.enum(["emerging", "growing", "mature", "declining"]),
    relatedIndustries: list,
    regulatoryConsiderations: list,
    rationale: s,
  }),

  audience: z.object({
    summary: s,
    segments: z.array(
      z.object({
        name: s,
        priority: z.enum(["primary", "secondary"]),
        description: s,
        demographics: s,
        psychographics: s,
        needs: list,
        buyingTriggers: list,
        whereToReach: list,
      }),
    ),
  }),

  problems: z.object({
    coreValueProposition: s,
    problems: z.array(
      z.object({
        problem: s,
        whoFeelsIt: s,
        severity: z.enum(["low", "medium", "high"]),
        currentAlternatives: s,
        howWeSolve: s,
      }),
    ),
  }),

  competitors: z.object({
    disclaimer: s.describe("State that this is based on general knowledge and must be verified with current market research."),
    competitors: z.array(
      z.object({
        name: s,
        type: z.enum(["direct", "indirect", "substitute"]),
        description: s,
        website: s.describe("Official website if well known, otherwise empty string. Never invent URLs."),
        pricePositioning: z.enum(["budget", "mid_market", "premium", "unknown"]),
        strengths: list,
        weaknesses: list,
      }),
    ),
    differentiationOpportunities: list,
  }),

  business_model: z.object({
    recommended: z.object({
      name: s,
      description: s,
      revenueStreams: list,
      pricingStrategy: s,
      costStructure: list,
      keyResources: list,
      channels: list,
    }),
    alternatives: z.array(z.object({ name: s, description: s, pros: list, cons: list })),
    productsAndServices: z.array(
      z.object({ name: s, type: z.enum(["product", "service"]), description: s, priceRange: s }),
    ),
  }),

  strategy: z.object({
    positioning: s,
    valueProposition: s,
    goals: z.array(z.object({ title: s, description: s, timeframe: s, metric: s })),
    phases: z.array(z.object({ name: s, timeframe: s, objectives: list, actions: list })),
    risks: z.array(z.object({ risk: s, mitigation: s })),
    keyMetrics: list,
  }),

  business_plan: z.object({
    executiveSummary: s,
    companyDescription: s,
    marketAnalysis: s,
    productsAndServices: s,
    marketingAndSales: s,
    operationsPlan: s,
    managementAndTeam: s,
    financialPlan: z.object({
      startupCosts: z.array(z.object({ item: s, estimate: s })),
      revenueAssumptions: list,
      breakEvenSummary: s,
    }),
    fundingRequirements: s,
    milestones: z.array(z.object({ milestone: s, targetDate: s.describe("Relative, e.g. 'Month 3'.") })),
  }),

  launch_checklist: z.object({
    categories: z.array(
      z.object({
        name: s,
        items: z.array(
          z.object({
            task: s,
            description: s,
            priority: z.enum(["high", "medium", "low"]),
            timeframe: s.describe("Relative, e.g. 'Week 1' or 'Before launch'."),
          }),
        ),
      }),
    ),
  }),
};

export const SECTION_KEYS = Object.keys(SECTION_SCHEMAS);

export const sectionKeySchema = z.enum(SECTION_KEYS);

export const generateSectionSchema = z.object({
  feedback: z.string().trim().max(1000).optional(),
});

export const acceptOutputSchema = z.object({ outputId: z.uuid() });

export const checklistStateSchema = z.object({
  completed: z.array(z.string().regex(/^\d{1,3}-\d{1,3}$/)).max(500),
});
