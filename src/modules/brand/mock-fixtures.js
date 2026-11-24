import { registerMockFixture } from "@/server/ai/providers/mock-fixtures.js";

/** Sample outputs for the TEST-ONLY mock AI provider (labelled "mock" in the UI). */
const T = "[Mock] ";
const concept = (over) => ({
  name: "Warm Croissant", rationale: `${T}Friendly bakery icon.`, markType: "icon", icon: "Croissant", monogram: "", shape: "circle",
  fontKey: "playfair_display", fontWeight: "700", letterCase: "as_is", letterSpacing: 0.01,
  colors: { mark: "#7a4b2a", markForeground: "#fbf3e8", text: "#2b1d14" }, ...over,
});

const FIXTURES = {
  personality: () => ({
    summary: `${T}Warm, crafted and neighbourly.`, archetype: "caregiver", secondaryArchetype: "creator",
    traits: ["Warm", "Crafted", "Honest"], weAre: ["Welcoming"], weAreNot: ["Pretentious"],
    brandPromise: `${T}Real bread, baked nearby.`, mission: `${T}Mission.`, vision: `${T}Vision.`,
    values: [{ name: "Craft", description: `${T}Slow fermentation.` }],
  }),
  voice: () => ({
    summary: `${T}Friendly and plain-spoken.`,
    toneAttributes: [{ attribute: "Warm", description: `${T}Like a neighbour.`, do: "Fresh out of the oven!", dont: "Synergistic bakery solutions." }],
    vocabulary: { preferred: ["fresh", "crafted"], avoid: ["cheap"] },
    writingGuidelines: [`${T}Short sentences.`],
    sampleMessages: [{ context: "Social post", message: `${T}Sourdough's ready!` }],
  }),
  taglines: () => ({
    taglines: [
      { text: "Baked fresh, every morning", angle: "benefit", rationale: `${T}Clear benefit.` },
      { text: "Your neighbourhood loaf", angle: "emotional", rationale: `${T}Local warmth.` },
    ],
    recommendation: `${T}Use the first.`,
  }),
  palettes: () => ({
    palettes: [
      { name: "Crust", mood: "Warm", description: `${T}Toasted browns.`, colors: { primary: "#7A4B2A", secondary: "#C89B6D", accent: "#E4572E", dark: "#2B1D14", light: "#F4E9DC", background: "#FFFBF5" }, usageNotes: [`${T}Primary for headers.`] },
      { name: "Flour", mood: "Calm", description: `${T}Soft neutrals.`, colors: { primary: "#3D5A80", secondary: "#98C1D9", accent: "#EE6C4D", dark: "#1D2731", light: "#E0FBFC", background: "#FFFFFF" }, usageNotes: [`${T}Use sparingly.`] },
    ],
    recommendation: `${T}Crust.`,
  }),
  typography: () => ({
    pairings: [
      { name: "Classic bakery", headingFont: "playfair_display", headingWeight: "700", bodyFont: "inter", bodyWeight: "400", personality: "Crafted", rationale: `${T}Serif warmth.` },
      { name: "Modern", headingFont: "montserrat", headingWeight: "800", bodyFont: "manrope", bodyWeight: "400", personality: "Clean", rationale: `${T}Geometric.` },
    ],
    recommendation: `${T}Classic bakery.`,
  }),
  logo_concepts: () => ({
    concepts: [
      concept(),
      concept({ name: "Monogram", markType: "monogram", icon: "", monogram: "CC", shape: "hexagon", fontKey: "montserrat", fontWeight: "800", letterCase: "upper", letterSpacing: 0.12 }),
      concept({ name: "Script", markType: "wordmark", icon: "", shape: "none", fontKey: "pacifico", fontWeight: "400" }),
    ],
    recommendation: `${T}Warm Croissant.`,
  }),
  guidelines: () => ({
    logoUsage: { clearSpace: `${T}Height of the mark.`, minimumSize: "24 px", dos: [`${T}Use on light backgrounds.`], donts: [`${T}Do not stretch.`] },
    colorUsage: [`${T}Primary for headings.`],
    typographyUsage: [`${T}Headings in Playfair Display.`],
    imageryStyle: { description: `${T}Natural light.`, dos: ["Close-ups"], donts: ["Stock clichés"] },
    applicationTips: [`${T}Stamp the mark on bags.`],
  }),
};

for (const [task, factory] of Object.entries(FIXTURES)) registerMockFixture("brand", task, factory);
