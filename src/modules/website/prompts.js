import "server-only";
import { ICON_NAMES } from "@/modules/brand/catalog/icons.js";
import { AI_SECTION_TYPES, SECTION_TYPES, THEMES, WEBSITE_TYPES } from "./catalog.js";

const COMMON = [
  "You are a senior web copywriter and UX writer in Brand AI's Website Builder.",
  "You write website CONTENT as structured data only. Never write HTML, CSS, JavaScript, Markdown or code; the app renders your content with its own components.",
  "Use the approved business context (offering, audience, brand voice, location). Be specific and concrete; avoid filler and buzzwords.",
  "Never invent facts: no prices, phone numbers, emails, addresses, opening hours, awards, statistics, client names or reviews that are not in the context or brief. Leave such fields empty instead.",
  "Equally, do not state specifics the owner has not given: durations, quantities, group sizes, opening days or times, delivery terms, minimum orders, ingredient sourcing, certifications or guarantees. Describe benefits in general terms instead.",
  "Never write testimonials or reviews.",
  "Links: use internal pages as '/slug' (e.g. '/contact'), anchors as '#section-type' (e.g. '#contact'), or leave empty. Do not invent external URLs.",
  `Section types you may use: ${AI_SECTION_TYPES.map((t) => `${t} (${SECTION_TYPES[t].description})`).join("; ")}.`,
  "Use items for cards: features/services/products/portfolio items have title + text (+ icon); faq items have the question as title and the answer as text.",
  `Icons: an exact name from this list, or empty: ${ICON_NAMES.join(", ")}.`,
].join("\n");

export function siteInstructions({ type, theme }) {
  const plan = WEBSITE_TYPES[type].pages.map((p) => `- page "${p.slug}" (${p.title}): sections in this order: ${p.sections.join(", ")}`).join("\n");
  return `${COMMON}\n\nWebsite type: ${WEBSITE_TYPES[type].label}. Visual style: ${THEMES[theme].label} (${THEMES[theme].description}).\n\nTask — Write the whole website. Return exactly these pages with these sections (you may add one extra section per page if it clearly helps):\n${plan}\n\nHero: a clear, benefit-led headline (max 9 words), a supporting line and a call to action linking to the contact page or #contact. Write SEO titles (≤ 60 chars) and descriptions (≤ 155 chars) for every page.`;
}

export function siteInput({ business, brief, products, services }) {
  const lines = [`<business>\nName: ${business.name}\nIndustry: ${business.industry ?? "not specified"}\nDescription: ${business.description ?? "not specified"}\n</business>`];
  if (brief) lines.push(`<brief>\n${brief}\n</brief>`);
  if (products.length) lines.push(`<products>\n${products.map((p) => `- ${p.name}${p.priceRange ? ` (${p.priceRange})` : ""}: ${p.description ?? ""}`).join("\n")}\n</products>\nThese real products are shown automatically in products sections; write the section headings and intro only.`);
  if (services.length) lines.push(`<services>\n${services.map((p) => `- ${p.name}${p.priceRange ? ` (${p.priceRange})` : ""}: ${p.description ?? ""}`).join("\n")}\n</services>`);
  return lines.join("\n\n");
}

export function sectionInstructions(type) {
  return `${COMMON}\n\nTask — Rewrite one "${type}" section (${SECTION_TYPES[type].description}) of the website. Keep type "${type}". Return the full section.`;
}

export function sectionInput({ business, page, section, instructions }) {
  const { id: _id, imageFileId: _img, background: _bg, ...content } = section;
  return [
    `<business>\nName: ${business.name}\nIndustry: ${business.industry ?? "not specified"}\n</business>`,
    `<page>${page.title} (/${page.slug})</page>`,
    `<current_section>\n${JSON.stringify({ ...content, items: content.items.map(({ imageFileId: _i, ...rest }) => rest) })}\n</current_section>`,
    `<revision_request>\n${instructions || "Improve it: clearer, more specific, more persuasive."}\n</revision_request>`,
  ].join("\n\n");
}
