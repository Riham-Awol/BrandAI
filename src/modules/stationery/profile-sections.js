/** Company profile (brochure) sections, in order (client-safe). */
export const PROFILE_SECTIONS = [
  { key: "overview", title: "Company overview", short: "Overview", description: "Who you are: headline, summary, mission, vision and values.", uses: [] },
  { key: "offering", title: "What we offer", short: "Offering", description: "Products and services, why choose you, and how you work.", uses: ["overview"] },
  { key: "closing", title: "Promise & contact", short: "Closing", description: "Who you serve, your commitments and the call to action.", uses: ["overview", "offering"] },
];
export const PROFILE_SECTION_BY_KEY = Object.fromEntries(PROFILE_SECTIONS.map((s) => [s.key, s]));
export const PROFILE_PRINT_STEP = { key: "brochure", title: "Brochure", short: "Brochure", description: "Preview and print the branded company profile." };
