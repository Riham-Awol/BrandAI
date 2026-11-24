import { registerMockFixture } from "@/server/ai/providers/mock-fixtures.js";

/** Sample outputs for the TEST-ONLY mock AI provider (labelled "mock" in the UI). */
const T = "[Mock] ";
export const DESIGN_OPTIONS_FIXTURE = {
  options: [
    {
      name: `${T}Fresh every morning`, template: "bold_headline", colorScheme: "light", eyebrow: "New this week",
      headline: "Sourdough baked before sunrise", subheadline: "Slow-fermented for 36 hours in Leeds.", body: "", bullets: ["No additives", "Local flour"],
      badge: "NEW", cta: "Order today", details: [], footer: "kirkgatebakery.example", icon: "Wheat", showLogo: true,
    },
    {
      name: `${T}Weekend offer`, template: "centered_badge", colorScheme: "primary", eyebrow: "",
      headline: "Two loaves, one happy weekend", subheadline: "", body: "Pick any two loaves on Saturday or Sunday.", bullets: [],
      badge: "[your offer]", cta: "Visit us", details: [], footer: "", icon: "Croissant", showLogo: true,
    },
    {
      name: `${T}Bread class`, template: "event_ticket", colorScheme: "dark", eyebrow: "Workshop",
      headline: "Learn to bake sourdough", subheadline: "A hands-on morning with our bakers.", body: "", bullets: [],
      badge: "", cta: "Book a place", details: [{ label: "Date", value: "Saturday 14 March" }, { label: "Where", value: "Kirkgate Market, Leeds" }],
      footer: "", icon: "Calendar", showLogo: true,
    },
  ],
};
registerMockFixture("design", "options", () => structuredClone(DESIGN_OPTIONS_FIXTURE));
