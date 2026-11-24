import { z } from "zod";

const s = z.string();
const list = z.array(z.string());

export const PROFILE_SCHEMAS = {
  overview: z.object({
    headline: s.describe("A confident one-line positioning statement (max 12 words)."),
    summary: s.describe("2–3 short paragraphs introducing the company, separated by blank lines."),
    mission: s.describe("One sentence."),
    vision: s.describe("One sentence."),
    values: z.array(z.object({ name: s, description: s })).describe("3–5 values with one-line explanations."),
  }),
  offering: z.object({
    intro: s.describe("1–2 sentences introducing the offer."),
    offerings: z.array(z.object({ name: s, description: s, benefits: list.describe("2–3 short benefits") })).describe("Main products/services from the context (do not invent new ones)."),
    whyChooseUs: z.array(z.object({ title: s, description: s })).describe("3–4 differentiators grounded in the context."),
    process: z.array(z.object({ step: s, description: s })).describe("3–5 steps of how customers work with you."),
  }),
  closing: z.object({
    audience: s.describe("Who you serve, 1–2 sentences."),
    commitments: list.describe("3–4 promises you can keep (no guarantees or figures)."),
    callToAction: s.describe("A short invitation to get in touch."),
  }),
};

export const createProfileSchema = z.object({
  businessId: z.uuid(),
  purpose: z.string().trim().max(500).optional().transform((v) => (v === "" ? undefined : v)),
});
