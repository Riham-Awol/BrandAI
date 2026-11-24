import "server-only";
import { FONTS } from "./catalog/fonts.js";
import { ICON_GROUPS } from "./catalog/icons.js";
import { BRAND_SECTION_BY_KEY } from "./sections.js";
import { SELECTABLE } from "./schemas.js";

const COMMON = [
  "You are a senior brand strategist and identity designer working in Brand AI's Brand Identity Studio.",
  "Create work that is specific to this business, its audience and market; avoid clichés and generic filler.",
  "Respect the stated style preferences and things to avoid. Ensure accessibility: text colours must have strong contrast with their backgrounds.",
  "Never copy or imitate existing brands' logos, names or trademarks.",
  "Write concise, professional English suitable for a global audience.",
].join(" ");

const FONT_LIST = FONTS.map((f) => `${f.key} (${f.family}, ${f.category}, weights ${f.weights.join("/")})`).join("; ");
const ICON_LIST = Object.entries(ICON_GROUPS).map(([group, names]) => `${group}: ${names.join(", ")}`).join("\n");

const TASKS = {
  personality: "Define the brand personality: a primary and secondary archetype, 4-6 traits, 3-5 'we are' and 'we are not' statements, a one-sentence brand promise, mission, vision and 3-5 values.",
  voice: "Define the brand voice: 3-4 tone attributes each with a do and a don't example, preferred and avoided vocabulary, 4-6 writing guidelines and 4 sample messages for different contexts (social post, website headline, customer service reply, promotional email subject).",
  taglines: "Write 8 distinct taglines (3-7 words each) using different angles. Avoid existing famous slogans. Recommend the best one and explain why.",
  palettes: "Create 3 distinct colour palettes that express the personality. Each must have primary, secondary, accent, dark, light and background colours as 6-digit hex values. Dark text on background must reach WCAG AA contrast (4.5:1). Recommend one.",
  typography: `Create 3 font pairings using ONLY these font keys: ${FONT_LIST}. Use weights the font actually has. Body fonts must be highly readable (sans or text serif, never script or display). Recommend one.`,
  logo_concepts: `Design 4 distinct logo concepts as structured specifications that will be rendered as vector logos.
Rules:
- fontKey must be one of: ${FONT_LIST}. Use a weight the font has.
- markType: "icon" (uses one icon from the list below), "monogram" (1-2 letters inside the shape) or "wordmark" (name only; shape is ignored).
- Use at least two different markTypes across the 4 concepts.
- icon must be EXACTLY one of these names (or empty string when not an icon concept):
${ICON_LIST}
- Colours must come from the selected palette; markForeground must contrast strongly with mark; text must read well on white.
- letterSpacing in em between -0.05 and 0.3 (wider for uppercase).
Recommend one concept.`,
  guidelines: "Write practical brand guidelines for the selected logo, colours and typography: logo clear space and minimum size, logo dos and don'ts, colour usage rules, typography usage rules, imagery style, and application tips (social media, signage, packaging, website).",
};

export function buildInstructions(section) {
  return `${COMMON}\n\nTask — ${BRAND_SECTION_BY_KEY[section].title}: ${TASKS[section]}`;
}

/** Earlier results: for "pick one" sections only the selected option is passed on. */
export function selectedOrAll(section, entry) {
  const listKey = SELECTABLE[section];
  if (!listKey) return entry.content;
  const items = entry.content[listKey] ?? [];
  const index = Math.min(entry.state?.selected ?? 0, Math.max(0, items.length - 1));
  return { selected: items[index] ?? null };
}

export function buildBrandInput({ project, previous, feedback, currentContent }) {
  const b = project.business;
  const prefs = project.input ?? {};
  const lines = [
    `<business>\nName: ${b.name}\nIndustry: ${b.industry ?? "not specified"}\nDescription: ${b.description ?? "not specified"}\nStage: ${b.stage}\n</business>`,
    `<preferences>\nStyle: ${(prefs.styleKeywords ?? []).join(", ") || "no preference"}\nColour preferences: ${prefs.colorPreferences ?? "none"}\nAvoid: ${prefs.avoid ?? "nothing specified"}\nInspiration: ${prefs.inspiration ?? "none"}\n</preferences>`,
  ];
  for (const [key, entry] of Object.entries(previous)) {
    lines.push(`<previous_result section="${key}">\n${JSON.stringify(selectedOrAll(key, entry))}\n</previous_result>`);
  }
  if (feedback) {
    if (currentContent) lines.push(`<current_version>\n${JSON.stringify(currentContent)}\n</current_version>`);
    lines.push(`<revision_request>\n${feedback}\n</revision_request>\nRevise the current version according to the revision request.`);
  }
  return lines.join("\n\n");
}

export const BRAND_AI_OPTIONS = {
  personality: { effort: "medium", maxTokens: 6000 },
  voice: { effort: "medium", maxTokens: 6000 },
  taglines: { effort: "low", maxTokens: 4000 },
  palettes: { effort: "medium", maxTokens: 6000 },
  typography: { effort: "low", maxTokens: 4000 },
  logo_concepts: { effort: "medium", maxTokens: 8000 },
  guidelines: { effort: "medium", maxTokens: 8000 },
};
