import { registerMockFixture } from "@/server/ai/providers/mock-fixtures.js";

/** Sample outputs for the TEST-ONLY mock AI provider (labelled "mock" in the UI). */
registerMockFixture("automation", "email_campaign", () => ({
  subject: "[Mock] Fresh rye is back this Saturday",
  preheader: "Slow-fermented, baked before sunrise",
  heading: "Our seeded rye is back",
  paragraphs: ["We've been asked every week — the seeded rye returns this Saturday.", "Come early: we bake a small batch."],
  ctaLabel: "Plan your visit",
}));
