import { z } from "zod";
import { ARTWORK_KEYS, COLORWAY_KEYS, MATERIAL_KIND_KEYS, PLACEMENT_KEYS, PRODUCT_COLOR_KEYS, TEMPLATE_KEYS } from "./catalog.js";

const s = (max) => z.string().trim().max(max);

/** All editable content and choices of a material (fields not used by a kind are ignored). */
export const materialSpecSchema = z.object({
  name: s(80).min(1, "Give it a name."),
  template: z.enum(TEMPLATE_KEYS),
  colorway: z.enum(COLORWAY_KEYS),
  productColor: z.enum(PRODUCT_COLOR_KEYS),
  artwork: z.enum(ARTWORK_KEYS),
  placement: z.enum(PLACEMENT_KEYS),
  slogan: s(60).describe("Short slogan/print text, or empty."),
  tagline: s(100).describe("Short tagline, or empty."),
  person: z.object({ name: s(80), title: s(80), phone: s(40), email: s(254) }),
  showDetails: z.boolean(),
  showRegistration: z.boolean(),
  footerNote: s(160),
  productName: s(60),
  descriptor: s(120).describe("One line describing the product, e.g. 'Seeded rye sourdough'."),
  details: z.array(z.object({ label: s(30), value: s(120) })).max(6).describe("Facts like weight or ingredients — only those given in the context or brief."),
  backText: s(600).describe("Short paragraph for the back of the pack, or empty."),
});

/** What the AI suggests for one option (merch, labels, packaging). */
export const aiMaterialOptionsSchema = z.object({
  options: z.array(
    z.object({
      name: s(80).describe("Short name for this option."),
      template: s(20).describe("Template key from the list, or empty."),
      colorway: s(20),
      productColor: s(20).describe("Product colour key from the list."),
      artwork: s(20).describe("Artwork key from the list."),
      placement: s(20).describe("Placement key from the list."),
      slogan: s(60),
      tagline: s(100),
      productName: s(60),
      descriptor: s(120),
      details: z.array(z.object({ label: s(30), value: s(120) })).max(6),
      backText: s(600),
    }),
  ),
});

export const materialBriefSchema = z.object({
  businessId: z.uuid(),
  kind: z.enum(MATERIAL_KIND_KEYS),
  brief: z.string().trim().max(1500).optional().transform((v) => (v === "" ? undefined : v)),
  person: z.object({ name: s(80), title: s(80), phone: s(40), email: s(254) }).partial().optional(),
});

export const saveMaterialSchema = z.object({
  businessId: z.uuid(),
  kind: z.enum(MATERIAL_KIND_KEYS),
  spec: materialSpecSchema,
  isMock: z.boolean().default(false),
});

export const updateMaterialSchema = z.object({ spec: materialSpecSchema });

export const materialPreviewSchema = z.object({ businessId: z.uuid(), kind: z.enum(MATERIAL_KIND_KEYS), spec: materialSpecSchema });
