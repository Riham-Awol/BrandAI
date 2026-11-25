import { registerMockFixture } from "@/server/ai/providers/mock-fixtures.js";

/** Sample output for the TEST-ONLY mock AI provider (labelled "mock" in the UI). */
registerMockFixture("analytics", "insights", () => ({
  summary: "[Mock] Your website is the main way new customers find you; emails bring people back.",
  highlights: [
    { title: "Visitors are coming from your website pages", detail: "Most page views land on the home page.", sentiment: "positive", metricKeys: ["website.visitors", "website.pageviews"] },
    { title: "Post results are missing", detail: "Add results from your platforms to compare posts.", sentiment: "neutral", metricKeys: ["engagement.posts"] },
  ],
  recommendations: [
    { title: "Add a clear enquiry button to the home page", action: "Put a 'Get in touch' button in the hero of your home page.", why: "Visitors arrive there first.", priority: "high", area: "website", metricKeys: ["website.conversionRate"] },
    { title: "Record post results weekly", action: "Each Friday, copy reach and likes for published posts into Analytics.", why: "Without results we can't tell which posts work.", priority: "medium", area: "social", metricKeys: ["engagement.posts", "not.a.metric"] },
  ],
  dataGaps: ["No post results entered yet."],
}));
