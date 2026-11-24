/**
 * Design formats, kinds, templates and colour schemes (client-safe).
 * Sizes are in CSS px of the artboard; print formats are A-series at 150 dpi and
 * exported as PNG at 2× (300 dpi).
 */
export const DESIGN_FORMATS = {
  a4_portrait: { label: "A4 poster", width: 1240, height: 1754, print: true },
  a5_portrait: { label: "A5 flyer", width: 874, height: 1240, print: true },
  square: { label: "Square 1080 × 1080", width: 1080, height: 1080 },
  portrait_4x5: { label: "Portrait 1080 × 1350", width: 1080, height: 1350 },
  story: { label: "Story / Reel cover 1080 × 1920", width: 1080, height: 1920 },
  landscape_post: { label: "Landscape post / link ad 1200 × 630", width: 1200, height: 630 },
  web_banner: { label: "Web banner 1500 × 500", width: 1500, height: 500 },
  medium_rectangle: { label: "Display ad 300 × 250", width: 300, height: 250 },
  leaderboard: { label: "Display ad 728 × 90", width: 728, height: 90 },
};
export const FORMAT_KEYS = Object.keys(DESIGN_FORMATS);

export const DESIGN_KINDS = {
  POSTER: { label: "Poster", formats: ["a4_portrait", "a5_portrait"] },
  FLYER: { label: "Flyer", formats: ["a5_portrait", "a4_portrait"] },
  AD: { label: "Advertising graphic", formats: ["square", "landscape_post", "story", "medium_rectangle", "leaderboard"] },
  BANNER: { label: "Banner", formats: ["web_banner", "leaderboard", "landscape_post"] },
  PRODUCT: { label: "Product graphic", formats: ["square", "portrait_4x5", "story"] },
  EVENT: { label: "Event graphic", formats: ["a4_portrait", "square", "story", "landscape_post"] },
  SOCIAL: { label: "Social media design", formats: ["square", "portrait_4x5", "story", "landscape_post"] },
};
export const KIND_KEYS = Object.keys(DESIGN_KINDS);

export const TEMPLATES = {
  bold_headline: "Bold headline",
  split_image: "Split image",
  centered_badge: "Centered badge",
  minimal_frame: "Minimal frame",
  diagonal_band: "Diagonal band",
  event_ticket: "Event ticket",
};
export const TEMPLATE_KEYS = Object.keys(TEMPLATES);

export const COLOR_SCHEMES = { light: "Light", dark: "Dark", primary: "Brand colour", accent: "Accent colour" };
export const COLOR_SCHEME_KEYS = Object.keys(COLOR_SCHEMES);

/** Best default format for a social post (Phase 4 → Phase 5). */
export const POST_FORMAT_TO_DESIGN = { POST: "square", CAROUSEL: "portrait_4x5", STORY: "story", SHORT_VIDEO: "story" };

export function isPrint(format) {
  return Boolean(DESIGN_FORMATS[format]?.print);
}
