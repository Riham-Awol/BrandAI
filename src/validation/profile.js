import { z } from "zod";
import { BUSINESS_STAGES } from "./business.js";

const text = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));
const required = (max, message) => z.string().trim().min(1, message).max(max);

const website = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), "Enter a full URL starting with http:// or https://")
  .optional()
  .transform((v) => (v ? v : undefined));

const offering = z.object({ name: required(160, "Enter a name."), description: text(2000), priceRange: text(120) });

export const businessProfileSchema = z.object({
  name: required(160, "Enter a business name."),
  industry: text(120),
  description: text(5000),
  stage: z.enum(BUSINESS_STAGES),
  valueProposition: text(2000),
  businessModel: text(4000),
  products: z.array(offering).max(50).default([]),
  services: z.array(offering).max(50).default([]),
  locations: z
    .array(
      z.object({
        label: text(120),
        city: text(120),
        region: text(120),
        country: required(120, "Enter a country."),
        isPrimary: z.boolean().default(false),
        isOnline: z.boolean().default(false),
      }),
    )
    .max(20)
    .default([]),
  audiences: z
    .array(z.object({ name: required(160, "Enter a segment name."), description: text(2000), demographics: text(1000), needs: text(2000), isPrimary: z.boolean().default(false) }))
    .max(20)
    .default([]),
  problems: z
    .array(z.object({ problem: required(2000, "Describe the problem."), solution: text(2000), severity: z.enum(["low", "medium", "high"]).optional() }))
    .max(30)
    .default([]),
  competitors: z
    .array(z.object({ name: required(160, "Enter a competitor name."), website, description: text(2000), strengths: text(2000), weaknesses: text(2000) }))
    .max(30)
    .default([]),
  goals: z
    .array(z.object({ title: required(200, "Enter a goal."), description: text(2000), timeframe: text(120), metric: text(200) }))
    .max(30)
    .default([]),
});
