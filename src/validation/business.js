import { z } from "zod";

export const BUSINESS_STAGES = ["IDEA", "STARTING", "OPERATING", "ESTABLISHED"];

export const createBusinessSchema = z.object({
  name: z.string().trim().min(1, "Enter a business name.").max(160),
  industry: z.string().trim().max(120).optional(),
  description: z.string().trim().max(5000).optional(),
  stage: z.enum(BUSINESS_STAGES).default("IDEA"),
});

export const updateBusinessSchema = createBusinessSchema.partial();

/**
 * Sections of the central business context. Each phase fills in the sections
 * it owns; AI modules only receive sections the user has approved.
 */
export const CONTEXT_SECTIONS = [
  "basics", // name, industry, description, location
  "offering", // products & services
  "audience", // target audience, customer problems
  "goals",
  "competitors",
  "brandIdentity", // colors, fonts, logo refs
  "brandVoice",
  "marketingPreferences",
];

const sectionValue = z.record(z.string(), z.unknown());

export const contextDataSchema = z
  .object(Object.fromEntries(CONTEXT_SECTIONS.map((s) => [s, sectionValue.optional()])))
  .strict();

export const saveContextDraftSchema = z.object({
  data: contextDataSchema,
  changeNote: z.string().trim().max(500).optional(),
});

export const approveContextSchema = z.object({
  sections: z.array(z.enum(CONTEXT_SECTIONS)).min(1, "Approve at least one section."),
});
