import { registerMockFixture } from "@/server/ai/providers/mock-fixtures.js";

/** Sample outputs for the TEST-ONLY mock AI provider (labelled "mock" in the UI). */
const T = "[Mock] ";
registerMockFixture("social", "pillars", () => ({
  pillars: [
    { name: "Behind the bake", description: `${T}Process and people.`, share: 40, examples: ["Dough at dawn"] },
    { name: "Community", description: `${T}Local life.`, share: 30, examples: ["Café partners"] },
    { name: "Offers", description: `${T}Promotions.`, share: 20, examples: ["Weekend deal"] },
  ],
  platformPlans: [{ platform: "INSTAGRAM", role: "Discovery", postsPerWeek: 3, formats: ["Reels", "Carousels"], bestTimes: "7-9am", tone: "Warm" }],
  hashtagSets: [{ pillar: "Behind the bake", hashtags: ["#sourdough", "Leeds Food", "#sourdough"] }],
  guidelines: [`${T}Show hands and bread.`],
}));
registerMockFixture("social", "calendar", () => ({
  entries: [
    { day: 3, platform: "INSTAGRAM", format: "SHORT_VIDEO", pillar: "Behind the bake", title: "Dough at dawn", objective: "Awareness", isPromotion: false },
    { day: 5, platform: "INSTAGRAM", format: "CAROUSEL", pillar: "Community", title: "Meet our café partners", objective: "Trust", isPromotion: false },
    { day: 8, platform: "FACEBOOK", format: "POST", pillar: "Offers", title: "Weekend loaf deal", objective: "Sales", isPromotion: true },
    { day: 12, platform: "INSTAGRAM", format: "STORY", pillar: "Community", title: "Which loaf next?", objective: "Engagement", isPromotion: false },
    { day: 40, platform: "INSTAGRAM", format: "POST", pillar: "x", title: "Out of range day", objective: "-", isPromotion: false },
    { day: 14, platform: "LINKEDIN", format: "POST", pillar: "x", title: "Unselected platform", objective: "-", isPromotion: false },
  ],
  notes: `${T}Plan around payday weekends.`,
}));
registerMockFixture("social", "posts", (request) => {
  const refs = [...request.prompt.matchAll(/<post ref="(\d+)">[\s\S]*?Format: ([^\n]+)/g)].map((m) => ({ ref: Number(m[1]), format: m[2] }));
  return {
    posts: refs.map(({ ref, format }) => ({
      ref,
      hook: `${T}Hook ${ref}`,
      caption: `${T}Fresh sourdough, baked before sunrise in Leeds. Post ${ref}.`,
      hashtags: ["sourdough", "#Leeds Bakery", "#sourdough", "#realbread"],
      callToAction: "Visit us on Kirkgate today.",
      altText: "A crusty sourdough loaf on a wooden board.",
      visualIdea: "Close-up of bread being torn open.",
      slides: [{ heading: "Slide 1", text: "Start" }, { heading: "Slide 2", text: "End" }],
      frames: [{ text: "Which loaf next?", visual: "Two loaves", interactive: "Poll: Rye or Seeded" }],
      scenes: [{ seconds: 3.4, visual: "Dough", voiceover: "It starts at 4am.", onScreenText: "4:00am" }, { seconds: 12, visual: "Oven", voiceover: "Then the oven.", onScreenText: "Bake" }],
      audio: format.includes("video") ? "Upbeat acoustic" : "should be removed",
      promotion: { offer: "[your offer]", code: "LOAF10", validUntil: "Sunday", terms: "While stocks last" },
    })),
  };
});
