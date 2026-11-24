/**
 * Stationery & merchandise kinds, templates, sizes and options (client-safe).
 * Sizes are physical (mm); artwork is drawn by code from validated specs.
 */
export const MATERIAL_KINDS = {
  BUSINESS_CARD: { label: "Business card", group: "stationery", size: "85 × 55 mm (+3 mm bleed)", templates: ["classic", "centered", "split"], ai: false, fields: ["person", "showDetails", "tagline"] },
  LETTERHEAD: { label: "Letterhead", group: "stationery", size: "A4 210 × 297 mm", templates: ["top_left", "centered", "side_band"], ai: false, fields: ["showRegistration", "footerNote"] },
  TSHIRT: { label: "T-shirt", group: "merch", size: "Print area up to 300 × 400 mm", placements: ["left_chest", "center_chest", "full_front", "back"], ai: true, fields: ["productColor", "artwork", "placement", "slogan"] },
  UNIFORM: { label: "Uniform polo shirt", group: "merch", size: "Print area up to 100 × 100 mm (chest) / 300 × 300 mm (back)", placements: ["left_chest", "back"], ai: true, fields: ["productColor", "artwork", "placement", "slogan", "person"] },
  BAG: { label: "Tote bag", group: "merch", size: "Print area 280 × 300 mm", placements: ["center", "lower"], ai: true, fields: ["productColor", "artwork", "placement", "slogan"] },
  MUG: { label: "Mug", group: "merch", size: "Wrap 200 × 85 mm (11 oz)", placements: ["front", "wrap"], ai: true, fields: ["productColor", "artwork", "placement", "slogan"] },
  LABEL: { label: "Product label", group: "packaging", size: "Round 60 mm · Rectangle 90 × 60 mm · Tag 50 × 90 mm", templates: ["round", "rectangle", "tag"], ai: true, fields: ["productName", "descriptor", "details", "tagline"] },
  PACKAGING: { label: "Packaging box", group: "packaging", size: "Tuck-end box dieline", templates: ["small", "medium", "tall"], ai: true, fields: ["productName", "descriptor", "tagline", "backText", "details", "artwork"] },
};
export const MATERIAL_KIND_KEYS = Object.keys(MATERIAL_KINDS);

export const GROUPS = { stationery: "Stationery", merch: "Merchandise", packaging: "Labels & packaging" };

export const TEMPLATE_LABELS = {
  classic: "Classic", centered: "Centered", split: "Split colour",
  top_left: "Logo left", side_band: "Side band",
  round: "Round sticker", rectangle: "Rectangle", tag: "Hang tag",
  small: "Small box (70 × 40 × 100 mm)", medium: "Medium box (100 × 60 × 150 mm)", tall: "Tall box (70 × 70 × 200 mm)",
};
export const TEMPLATE_KEYS = Object.keys(TEMPLATE_LABELS);

export const PLACEMENT_LABELS = { left_chest: "Left chest", center_chest: "Centre chest", full_front: "Full front", back: "Back", center: "Centre", lower: "Lower", front: "Front", wrap: "Wrap-around" };
export const PLACEMENT_KEYS = Object.keys(PLACEMENT_LABELS);

export const PRODUCT_COLORS = { white: "White", black: "Black", natural: "Natural canvas", primary: "Brand colour", secondary: "Secondary colour", dark: "Brand dark", light: "Brand light" };
export const PRODUCT_COLOR_KEYS = Object.keys(PRODUCT_COLORS);

export const ARTWORKS = { logo: "Full logo", logo_mark: "Logo symbol", wordmark: "Name only", slogan: "Slogan", slogan_logo: "Symbol + slogan", pattern: "Icon pattern" };
export const ARTWORK_KEYS = Object.keys(ARTWORKS);

export const COLORWAYS = { light: "Light", dark: "Dark", primary: "Brand colour", accent: "Accent colour" };
export const COLORWAY_KEYS = Object.keys(COLORWAYS);

/** Defaults per kind, used when the AI or user omits/garbles a choice. */
export function defaultsFor(kind) {
  const k = MATERIAL_KINDS[kind];
  return { template: k.templates?.[0] ?? "classic", placement: k.placements?.[0] ?? "center" };
}
