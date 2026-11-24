import "server-only";
import { ICON_NAMES } from "@/modules/brand/catalog/icons.js";
import { COLOR_SCHEMES, DESIGN_FORMATS, DESIGN_KINDS, TEMPLATES } from "./catalog.js";

const TEMPLATE_GUIDE = {
  bold_headline: "big headline on a plain background with a decorative shape; good for announcements and offers",
  split_image: "half photo, half text; use when a product/venue photo is provided or would help",
  centered_badge: "centered layout with a round badge (offer, price, 'NEW'); good for promotions",
  minimal_frame: "elegant thin frame, centered text, lots of space; good for premium or calm brands",
  diagonal_band: "headline on a bold diagonal colour band; energetic, sales and launches",
  event_ticket: "ticket-style header plus event details (date, time, place, price); good for events",
};

export function designInstructions({ kind, format, hasImage }) {
  const f = DESIGN_FORMATS[format];
  return [
    "You are a senior graphic designer and copywriter in Brand AI's Creative Design Studio.",
    "You write the copy and choose the layout for a graphic; the app draws it with the approved brand logo, colours and fonts, so do not describe colours or fonts.",
    "Use the approved brand voice, audience and offer from the business context. Be specific; never invent prices, discounts, dates, reviews or statistics that are not in the brief or context — leave those fields empty instead.",
    "Keep copy short: graphics are read in seconds. Headline at most 8 words. Use empty strings for fields you don't need.",
    `\nDesign type: ${DESIGN_KINDS[kind].label}. Format: ${f.label} (${f.width}×${f.height}px${f.print ? ", printed" : ""}).`,
    f.width / f.height > 3 ? "This is a very small/wide banner: only the headline, an optional short subheadline, badge and CTA will be shown." : "",
    `\nTemplates (choose by key):\n${Object.entries(TEMPLATES).map(([k, label]) => `- ${k} (${label}): ${TEMPLATE_GUIDE[k]}`).join("\n")}`,
    `Colour schemes: ${Object.keys(COLOR_SCHEMES).join(", ")}.`,
    hasImage ? "A photo is provided by the user; prefer split_image for at least one option." : "No photo is provided; split_image will show an icon panel instead.",
    `Icon: one exact name from this list, or empty: ${ICON_NAMES.join(", ")}.`,
    "\nTask — Return exactly 3 different options. Each must use a different template and they should differ in angle (e.g. benefit-led, offer-led, story-led). Give each a short descriptive name.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function designInput({ business, brief, sourcePost }) {
  const lines = [`<business>\nName: ${business.name}\nIndustry: ${business.industry ?? "not specified"}\n</business>`, `<brief>\n${brief.brief}\n</brief>`];
  if (brief.details) lines.push(`<facts>\n${brief.details}\n</facts>\nUse these facts exactly (e.g. in details, badge or footer).`);
  if (brief.cta) lines.push(`<call_to_action>\n${brief.cta}\n</call_to_action>`);
  if (sourcePost) lines.push(`<social_post>\n${JSON.stringify(sourcePost)}\n</social_post>\nDesign the graphic for this post.`);
  return lines.join("\n\n");
}
