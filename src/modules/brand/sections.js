/** Brand Identity Studio sections in guided order (client-safe). */
export const BRAND_SECTIONS = [
  { key: "personality", title: "Brand personality", short: "Personality", description: "Archetype, traits, mission and values.", uses: [] },
  { key: "voice", title: "Brand voice", short: "Voice", description: "How your brand sounds, with examples.", uses: ["personality"] },
  { key: "taglines", title: "Taglines", short: "Taglines", description: "Short lines that capture your promise. Pick one.", uses: ["personality", "voice"] },
  { key: "palettes", title: "Colour palette", short: "Colours", description: "Palettes with contrast checks. Pick one.", uses: ["personality"] },
  { key: "typography", title: "Typography", short: "Type", description: "Heading and body font pairings. Pick one.", uses: ["personality", "palettes"] },
  { key: "logo_concepts", title: "Logo", short: "Logo", description: "Vector logo concepts and variations. Pick and refine one.", uses: ["personality", "taglines", "palettes", "typography"] },
  { key: "guidelines", title: "Brand guidelines", short: "Guidelines", description: "Rules for using your brand consistently.", uses: ["personality", "voice", "taglines", "palettes", "typography", "logo_concepts"] },
];

export const BRAND_SECTION_BY_KEY = Object.fromEntries(BRAND_SECTIONS.map((s) => [s.key, s]));
export const IDENTITY_STEP = { key: "identity", title: "Review & approve", short: "Approve", description: "Approve your brand identity for reuse across Brand AI." };

/** Sections that must exist before the identity can be approved. */
export const REQUIRED_FOR_APPROVAL = ["personality", "voice", "palettes", "typography", "logo_concepts"];
