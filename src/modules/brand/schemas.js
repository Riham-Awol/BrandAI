import { z } from "zod";
import { FONT_KEYS, FONT_WEIGHTS } from "./catalog/fonts.js";

/**
 * Brand Identity Studio schemas (client + server).
 * Hex colours are plain strings in the AI schema and are normalized and
 * validated by the module's post-processing (see service.js), because
 * structured-output schemas avoid regex patterns.
 */

export const STYLE_KEYWORDS = ["modern", "classic", "minimal", "bold", "playful", "elegant", "luxurious", "friendly", "organic", "technical", "rustic", "youthful"];

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

export const brandInputSchema = z.object({
  styleKeywords: z.array(z.enum(STYLE_KEYWORDS)).max(5).default([]),
  colorPreferences: optionalText(500),
  avoid: optionalText(500),
  inspiration: optionalText(1000),
});

export const createBrandProjectSchema = brandInputSchema.extend({ businessId: z.uuid() });

const s = z.string();
const list = z.array(z.string());
const hex = (what) => s.describe(`Hex colour like #1F2A44 (${what}).`);

export const ARCHETYPES = ["innocent", "everyman", "hero", "outlaw", "explorer", "creator", "ruler", "magician", "lover", "caregiver", "jester", "sage"];
export const MARK_TYPES = ["monogram", "icon", "wordmark"];
export const MARK_SHAPES = ["none", "circle", "rounded_square", "squircle", "hexagon", "shield", "diamond"];
export const LETTER_CASES = ["as_is", "upper", "lower", "title"];

export const logoConceptSchema = z.object({
  name: s.describe("Short name for this concept."),
  rationale: s,
  markType: z.enum(MARK_TYPES),
  icon: s.describe("Exact icon name from the provided icon list (used when markType is icon), otherwise empty string."),
  monogram: s.describe("1–2 letters for a monogram mark (used when markType is monogram), otherwise empty string."),
  shape: z.enum(MARK_SHAPES),
  fontKey: z.enum(FONT_KEYS),
  fontWeight: z.enum(FONT_WEIGHTS),
  letterCase: z.enum(LETTER_CASES),
  letterSpacing: z.number().describe("Tracking in em, between -0.05 and 0.3."),
  colors: z.object({ mark: hex("mark/shape fill"), markForeground: hex("icon or letters inside the mark"), text: hex("business name") }),
});

export const SECTION_SCHEMAS = {
  personality: z.object({
    summary: s,
    archetype: z.enum(ARCHETYPES),
    secondaryArchetype: z.enum(ARCHETYPES),
    traits: list,
    weAre: list,
    weAreNot: list,
    brandPromise: s,
    mission: s,
    vision: s,
    values: z.array(z.object({ name: s, description: s })),
  }),

  voice: z.object({
    summary: s,
    toneAttributes: z.array(z.object({ attribute: s, description: s, do: s, dont: s })),
    vocabulary: z.object({ preferred: list, avoid: list }),
    writingGuidelines: list,
    sampleMessages: z.array(z.object({ context: s, message: s })),
  }),

  taglines: z.object({
    taglines: z.array(z.object({ text: s, angle: z.enum(["benefit", "emotional", "descriptive", "playful", "aspirational", "action"]), rationale: s })),
    recommendation: s,
  }),

  palettes: z.object({
    palettes: z.array(
      z.object({
        name: s,
        mood: s,
        description: s,
        colors: z.object({
          primary: hex("main brand colour"),
          secondary: hex("supporting colour"),
          accent: hex("highlight / call to action"),
          dark: hex("text and dark surfaces"),
          light: hex("light surfaces"),
          background: hex("page background"),
        }),
        usageNotes: list,
      }),
    ),
    recommendation: s,
  }),

  typography: z.object({
    pairings: z.array(
      z.object({
        name: s,
        headingFont: z.enum(FONT_KEYS),
        headingWeight: z.enum(FONT_WEIGHTS),
        bodyFont: z.enum(FONT_KEYS),
        bodyWeight: z.enum(FONT_WEIGHTS),
        personality: s,
        rationale: s,
      }),
    ),
    recommendation: s,
  }),

  logo_concepts: z.object({ concepts: z.array(logoConceptSchema), recommendation: s }),

  guidelines: z.object({
    logoUsage: z.object({ clearSpace: s, minimumSize: s, dos: list, donts: list }),
    colorUsage: list,
    typographyUsage: list,
    imageryStyle: z.object({ description: s, dos: list, donts: list }),
    applicationTips: list,
  }),
};

export const SECTION_KEYS = Object.keys(SECTION_SCHEMAS);

/** Sections where the user picks one option; the choice is stored in output.state. */
export const SELECTABLE = { taglines: "taglines", palettes: "palettes", typography: "pairings", logo_concepts: "concepts" };

export const selectionStateSchema = z.object({ selected: z.number().int().min(0).max(99) });

export const LOGO_VARIANTS = ["horizontal", "stacked", "mark", "wordmark"];
export const LOGO_THEMES = ["color", "mono", "inverse"];

export const logoPreviewSchema = z.object({
  concept: logoConceptSchema,
  variant: z.enum(LOGO_VARIANTS).default("horizontal"),
  theme: z.enum(LOGO_THEMES).default("color"),
});
