import { z } from "zod";
import { COLOR_SCHEME_KEYS, FORMAT_KEYS, KIND_KEYS, TEMPLATE_KEYS } from "./catalog.js";

const s = (max) => z.string().max(max);
const list = z.array(z.string().max(160)).max(6);

/** The editable content and layout choices of a design (AI output and user edits). */
export const designSpecSchema = z.object({
  name: s(80).describe("Short name for this variation."),
  template: z.enum(TEMPLATE_KEYS),
  colorScheme: z.enum(COLOR_SCHEME_KEYS),
  eyebrow: s(80).describe("Small text above the headline, or empty."),
  headline: s(160).describe("Main message, max ~8 words."),
  subheadline: s(240).describe("Supporting line, or empty."),
  body: s(600).describe("1-2 short sentences, or empty."),
  bullets: list.describe("0-4 short points."),
  badge: s(40).describe("Short offer/label in a badge, e.g. '20% OFF', or empty."),
  cta: s(60).describe("Call to action, e.g. 'Order today'."),
  details: z.array(z.object({ label: s(40), value: s(160) })).max(6).describe("0-4 facts such as date, time, location, price."),
  footer: s(200).describe("Website, address or contact line, or empty."),
  icon: s(60).describe("Exact icon name from the provided list, or empty."),
  showLogo: z.boolean(),
});

export const designOptionsSchema = z.object({ options: z.array(designSpecSchema) });

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

export const designBriefSchema = z
  .object({
    businessId: z.uuid(),
    kind: z.enum(KIND_KEYS),
    format: z.enum(FORMAT_KEYS),
    brief: z.string().trim().min(5, "Describe what the design is for.").max(2000),
    details: optionalText(1000),
    cta: optionalText(120),
    imageFileId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
    sourcePostId: z.uuid().optional(),
  });

export const saveDesignSchema = z.object({
  businessId: z.uuid(),
  kind: z.enum(KIND_KEYS),
  format: z.enum(FORMAT_KEYS),
  brief: z.record(z.string(), z.unknown()).default({}),
  spec: designSpecSchema,
  imageFileId: z.uuid().nullable().optional(),
  sourcePostId: z.uuid().nullable().optional(),
  isMock: z.boolean().default(false),
});

export const updateDesignSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  format: z.enum(FORMAT_KEYS).optional(),
  spec: designSpecSchema.optional(),
  imageFileId: z.uuid().nullable().optional(),
});

export const previewSchema = z.object({
  businessId: z.uuid(),
  format: z.enum(FORMAT_KEYS),
  spec: designSpecSchema,
  imageFileId: z.uuid().nullable().optional(),
});
