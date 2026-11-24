import { contrastRatio, normalizeHex } from "@/modules/brand/color.js";
import { FONT_BY_KEY } from "@/modules/brand/catalog/fonts.js";

const FALLBACK = { primary: "#302442", secondary: "#b9a0d2", accent: "#e4572e", dark: "#17151c", light: "#efe9f5", background: "#ffffff" };

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `#${[c(16), c(8), c(0)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Readable text for a background: the preferred colour if it passes AA, else near-black/white. */
function onBg(bg, preferred) {
  if (preferred && contrastRatio(preferred, bg) >= 4.5) return preferred;
  for (const c of ["#17151c", "#ffffff", "#000000"]) if (contrastRatio(c, bg) >= 4.5) return c;
  return contrastRatio("#000000", bg) > contrastRatio("#ffffff", bg) ? "#000000" : "#ffffff";
}

/** A button colour that stands out on `bg` (≥ 3:1), falling back to the text colour. */
function standout(bg, candidates, fallback) {
  return candidates.find((c) => c && contrastRatio(c, bg) >= 3) ?? fallback;
}

/**
 * CSS custom properties for a site from validated brand colours. Every text/background
 * pair meets WCAG AA (4.5:1), whatever palette the brand has. Pure.
 */
export function siteThemeVars(brandColors = {}) {
  const c = Object.fromEntries(Object.keys(FALLBACK).map((k) => [k, normalizeHex(brandColors[k]) ?? FALLBACK[k]]));
  const bg = c.background;
  const fg = onBg(bg, c.dark);
  const soft = mix(bg, c.primary, 0.07);
  const btn = standout(bg, [c.primary, c.accent, c.dark], fg);
  const accentBg = c.primary;
  const inverseBg = contrastRatio(c.dark, bg) >= 3 ? c.dark : "#17151c";
  return {
    "--s-bg": bg,
    "--s-fg": fg,
    "--s-muted-fg": contrastRatio(mix(fg, bg, 0.3), bg) >= 4.5 ? mix(fg, bg, 0.3) : fg,
    "--s-soft": soft,
    "--s-soft-fg": onBg(soft, fg),
    "--s-border": mix(bg, fg, 0.14),
    "--s-btn": btn,
    "--s-btn-fg": onBg(btn, bg),
    "--s-highlight": standout(bg, [c.accent, c.primary], fg),
    "--s-accent-bg": accentBg,
    "--s-accent-fg": onBg(accentBg, c.light),
    "--s-accent-btn": standout(accentBg, [c.light, c.background, c.accent], onBg(accentBg)),
    "--s-accent-btn-fg": onBg(standout(accentBg, [c.light, c.background, c.accent], onBg(accentBg)), accentBg),
    "--s-inverse-bg": inverseBg,
    "--s-inverse-fg": onBg(inverseBg, c.light),
    "--s-inverse-muted": onBg(inverseBg, mix(onBg(inverseBg, c.light), inverseBg, 0.25)),
  };
}

function face(family, key, weight) {
  const font = FONT_BY_KEY[key];
  const w = Number(weight);
  if (!font || !font.weights.includes(w)) return "";
  return `@font-face{font-family:"${family}";src:url(/api/v1/fonts/${key}/${w}) format("woff");font-weight:${w};font-display:swap}`;
}

/** @font-face rules for the brand's heading/body fonts (keys validated against the bundled catalog). */
export function siteFontCss(brand) {
  const h = brand?.heading ?? { fontKey: "fraunces", weight: "700" };
  const b = brand?.body ?? { fontKey: "manrope", weight: "500" };
  const bodyBold = FONT_BY_KEY[b.fontKey]?.weights.includes(700) ? 700 : Number(b.weight);
  return [face("site-heading", h.fontKey, h.weight), face("site-body", b.fontKey, b.weight), face("site-body", b.fontKey, bodyBold)].join("");
}

export const SITE_FONT_STACKS = {
  heading: '"site-heading", ui-serif, Georgia, serif',
  body: '"site-body", ui-sans-serif, system-ui, sans-serif',
};
