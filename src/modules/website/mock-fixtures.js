import { registerMockFixture } from "@/server/ai/providers/mock-fixtures.js";
import { WEBSITE_TYPES } from "./catalog.js";

/** Sample outputs for the TEST-ONLY mock AI provider (labelled "mock" in the UI). */
const T = "[Mock] ";
const item = (title, text, icon = "", link = "") => ({ title, text, meta: "", icon, link });
const SAMPLE = {
  hero: { eyebrow: "Leeds bakery", heading: `${T}Real bread, baked before sunrise`, subheading: "Slow-fermented sourdough from Kirkgate Market.", body: "", ctaLabel: "Visit us", ctaLink: "contact", secondaryLabel: "See the bread", secondaryLink: "javascript:alert(1)", items: [] },
  features: { eyebrow: "", heading: "Why locals choose us", subheading: "", body: "", ctaLabel: "", ctaLink: "", secondaryLabel: "", secondaryLink: "", items: [item("36-hour ferment", "Better flavour, easier to digest.", "wheat"), item("Local flour", "Milled in Yorkshire.", "Leaf"), item("Baked daily", "Fresh every morning.", "not-an-icon")] },
  services: { eyebrow: "", heading: "What we offer", subheading: "", body: "", ctaLabel: "", ctaLink: "", secondaryLabel: "", secondaryLink: "", items: [item("Café wholesale", "Daily bread for cafés."), item("Bread classes", "Learn sourdough with us.")] },
  products: { eyebrow: "", heading: "Today's bread", subheading: "Order ahead and collect.", body: "", ctaLabel: "", ctaLink: "", secondaryLabel: "", secondaryLink: "", items: [item("Country loaf", "Our everyday sourdough."), item("Seeded rye", "Dense and nutty.")] },
  portfolio: { eyebrow: "", heading: "Recent work", subheading: "", body: "", ctaLabel: "", ctaLink: "", secondaryLabel: "", secondaryLink: "", items: [item("Café partnership", "Daily bread for six cafés.")] },
  gallery: { eyebrow: "", heading: "From the bakery", subheading: "", body: "", ctaLabel: "", ctaLink: "", secondaryLabel: "", secondaryLink: "", items: [] },
  about: { eyebrow: "Our story", heading: "Baking for our neighbours", subheading: "", body: "We started with one oven and a stubborn starter.\n\nToday we bake for the whole market.", ctaLabel: "", ctaLink: "", secondaryLabel: "", secondaryLink: "", items: [] },
  faq: { eyebrow: "", heading: "Questions", subheading: "", body: "", ctaLabel: "", ctaLink: "", secondaryLabel: "", secondaryLink: "", items: [item("Do you deliver?", "Collection only for now.")] },
  cta: { eyebrow: "", heading: "Come and taste it", subheading: "", body: "", ctaLabel: "Find us", ctaLink: "/contact", secondaryLabel: "", secondaryLink: "", items: [] },
  contact: { eyebrow: "", heading: "Say hello", subheading: "Questions, orders or wholesale — send us a message.", body: "", ctaLabel: "", ctaLink: "", secondaryLabel: "", secondaryLink: "", items: [] },
  text: { eyebrow: "", heading: "", subheading: "", body: "Text", ctaLabel: "", ctaLink: "", secondaryLabel: "", secondaryLink: "", items: [] },
};

registerMockFixture("website", "site", (request) => {
  const type = Object.keys(WEBSITE_TYPES).find((k) => request.system.includes(`Website type: ${WEBSITE_TYPES[k].label}.`)) ?? "BUSINESS";
  return {
    tagline: `${T}Real bread for Leeds`,
    footerText: "Baked in Leeds since 2024.",
    pages: WEBSITE_TYPES[type].pages.map((p) => ({
      slug: p.slug,
      title: p.title,
      seoTitle: `${p.title} | Kirkgate Bakery`,
      seoDescription: `${T}Sourdough bakery in Leeds — ${p.title.toLowerCase()}.`,
      // Skips the first planned section on non-home pages to prove the app fills gaps.
      sections: p.sections.filter((s, i) => p.slug === "home" || i > 0).map((s) => ({ type: s, ...SAMPLE[s] })),
    })),
  };
});

registerMockFixture("website", "section", (request) => {
  const type = request.system.match(/Rewrite one "([a-z]+)" section/)?.[1] ?? "text";
  return { type, ...SAMPLE[type], heading: `${T}Rewritten ${type}` };
});
