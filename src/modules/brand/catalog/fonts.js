/**
 * Curated, open-licensed (SIL OFL) fonts bundled with the app via
 * @fontsource. Used for logo rendering (server, converted to outlines) and
 * typography previews (self-hosted, no third-party font requests).
 * Latin character set only in Phase 2.
 */
export const FONTS = [
  { key: "inter", family: "Inter", pkg: "inter", category: "sans", weights: [400, 500, 600, 700, 800, 900] },
  { key: "manrope", family: "Manrope", pkg: "manrope", category: "sans", weights: [400, 500, 600, 700, 800] },
  { key: "montserrat", family: "Montserrat", pkg: "montserrat", category: "sans", weights: [400, 500, 600, 700, 800, 900] },
  { key: "poppins", family: "Poppins", pkg: "poppins", category: "sans", weights: [400, 500, 600, 700, 800, 900] },
  { key: "space_grotesk", family: "Space Grotesk", pkg: "space-grotesk", category: "sans", weights: [400, 500, 600, 700] },
  { key: "raleway", family: "Raleway", pkg: "raleway", category: "sans", weights: [400, 500, 600, 700, 800, 900] },
  { key: "work_sans", family: "Work Sans", pkg: "work-sans", category: "sans", weights: [400, 500, 600, 700, 800, 900] },
  { key: "playfair_display", family: "Playfair Display", pkg: "playfair-display", category: "serif", weights: [400, 500, 600, 700, 800, 900] },
  { key: "dm_serif_display", family: "DM Serif Display", pkg: "dm-serif-display", category: "serif", weights: [400] },
  { key: "fraunces", family: "Fraunces", pkg: "fraunces", category: "serif", weights: [400, 500, 600, 700, 800, 900] },
  { key: "lora", family: "Lora", pkg: "lora", category: "serif", weights: [400, 500, 600, 700] },
  { key: "bebas_neue", family: "Bebas Neue", pkg: "bebas-neue", category: "display", weights: [400] },
  { key: "archivo_black", family: "Archivo Black", pkg: "archivo-black", category: "display", weights: [400] },
  { key: "pacifico", family: "Pacifico", pkg: "pacifico", category: "script", weights: [400] },
  { key: "dancing_script", family: "Dancing Script", pkg: "dancing-script", category: "script", weights: [400, 500, 600, 700] },
];

export const FONT_KEYS = FONTS.map((f) => f.key);
export const FONT_BY_KEY = Object.fromEntries(FONTS.map((f) => [f.key, f]));
export const FONT_WEIGHTS = ["400", "500", "600", "700", "800", "900"];

/** Closest available weight for a font (pure). */
export function nearestWeight(fontKey, weight) {
  const available = FONT_BY_KEY[fontKey]?.weights ?? [400];
  const target = Number(weight) || 400;
  return available.reduce((best, w) => (Math.abs(w - target) < Math.abs(best - target) ? w : best), available[0]);
}

export function fontUrl(key, weight) {
  return `/api/v1/fonts/${key}/${nearestWeight(key, weight)}`;
}
