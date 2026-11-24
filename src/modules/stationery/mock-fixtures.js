import { registerMockFixture } from "@/server/ai/providers/mock-fixtures.js";

/** Sample outputs for the TEST-ONLY mock AI provider (labelled "mock" in the UI). */
const T = "[Mock] ";
const empty = { template: "", colorway: "", productColor: "", artwork: "", placement: "", slogan: "", tagline: "", productName: "", descriptor: "", details: [], backText: "" };
registerMockFixture("stationery", "materials", () => ({
  options: [
    { ...empty, name: `${T}Classic logo`, template: "round", colorway: "light", productColor: "white", artwork: "logo", placement: "left chest", productName: "Seeded Rye", descriptor: "Slow-fermented sourdough", details: [{ label: "Net weight", value: "800 g" }], tagline: "Baked before sunrise", backText: "Baked in Leeds." },
    { ...empty, name: `${T}Bold slogan`, template: "tag", colorway: "dark", productColor: "black", artwork: "slogan_logo", placement: "full_front", slogan: "Proper bread", productName: "Country Loaf", descriptor: "Everyday sourdough" },
    { ...empty, name: `${T}Pattern`, template: "nonsense", colorway: "purple", productColor: "neon", artwork: "pattern", placement: "nowhere", productName: "Rye", descriptor: "Dense and nutty" },
  ],
}));

registerMockFixture("stationery", "document_text", () => ({
  intro: `${T}Thank you for asking us to quote for your café's weekly bread order. Below is everything included.`,
  notes: "Thank you for your business!",
  terms: "This quotation is valid for 30 days. To accept, reply to this email or sign below. Payment is due within the stated terms.",
}));

registerMockFixture("company_profile", "overview", () => ({
  headline: `${T}Real bread for real neighbourhoods`,
  summary: "Kirkgate Bakery bakes slow-fermented sourdough in Leeds.\n\nWe bake for people who care what goes into their food.",
  mission: "To make proper bread part of everyday life.",
  vision: "A bakery on every high street that bakes the real thing.",
  values: [{ name: "Patience", description: "Good bread takes time." }, { name: "Honesty", description: "Four ingredients, nothing hidden." }, { name: "Community", description: "We bake for our neighbours." }],
}));
registerMockFixture("company_profile", "offering", () => ({
  intro: `${T}Everything we sell is baked on site.`,
  offerings: [{ name: "Sourdough loaves", description: "Country, rye and seeded.", benefits: ["Long ferment", "Local flour"] }, { name: "Café wholesale", description: "Daily bread for cafés.", benefits: ["Early delivery", "Consistent quality"] }],
  whyChooseUs: [{ title: "Slow fermentation", description: "Flavour you can taste." }, { title: "Baked daily", description: "Fresh every morning." }, { title: "Local", description: "Part of Kirkgate Market." }],
  process: [{ step: "Talk to us", description: "Tell us what you need." }, { step: "Taste", description: "Try our range." }, { step: "Order", description: "We bake it fresh for you." }],
}));
registerMockFixture("company_profile", "closing", () => ({
  audience: `${T}Home bakers, families and independent cafés across Leeds.`,
  commitments: ["Real ingredients only", "Baked the same day", "Friendly, honest service"],
  callToAction: "Visit us at the market or get in touch to talk wholesale.",
}));
