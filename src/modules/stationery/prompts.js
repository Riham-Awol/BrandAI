import "server-only";
import { ARTWORKS, COLORWAYS, MATERIAL_KINDS, PLACEMENT_LABELS, PRODUCT_COLORS, TEMPLATE_LABELS } from "./catalog.js";

export function materialInstructions(kind) {
  const k = MATERIAL_KINDS[kind];
  const lines = [
    "You are a senior brand and packaging designer in Brand AI's Stationery & Merchandise Studio.",
    "You choose design options and write short print copy as structured data. The app draws the artwork with the approved logo, colours and fonts — never describe fonts or hex colours.",
    "Use the approved brand voice, offering and audience from the business context.",
    "Never invent facts: weights, ingredients, allergens, certifications, prices, dates or claims must come from the brief or context. If not given, leave details empty.",
    `\nItem: ${k.label} (${k.size}).`,
  ];
  if (k.templates) lines.push(`Templates (key: meaning): ${k.templates.map((x) => `${x}: ${TEMPLATE_LABELS[x]}`).join("; ")}.`);
  if (k.placements) lines.push(`Placements: ${k.placements.map((x) => `${x}: ${PLACEMENT_LABELS[x]}`).join("; ")}.`);
  if (["TSHIRT", "UNIFORM", "BAG", "MUG"].includes(kind)) {
    lines.push(`Product colours: ${Object.keys(PRODUCT_COLORS).join(", ")}. Artwork: ${Object.entries(ARTWORKS).map(([key, label]) => `${key} (${label})`).join(", ")}.`);
    lines.push("Slogans: max 5 words, on-brand, no hashtags. Uniforms should look professional (usually the logo on the left chest).");
  }
  if (["LABEL", "PACKAGING"].includes(kind)) lines.push(`Colourways: ${Object.keys(COLORWAYS).join(", ")}. productName max 4 words; descriptor one short line; backText 2–4 sentences (packaging only).`);
  lines.push("\nTask — Return exactly 3 clearly different options with short names.");
  return lines.join("\n");
}

export function materialInput({ business, brief, products }) {
  const lines = [`<business>\nName: ${business.name}\nIndustry: ${business.industry ?? "not specified"}\n</business>`];
  if (products.length) lines.push(`<products>\n${products.map((p) => `- ${p.name}${p.description ? `: ${p.description}` : ""}`).join("\n")}\n</products>`);
  lines.push(`<brief>\n${brief || "No extra brief — use the business context."}\n</brief>`);
  return lines.join("\n\n");
}
