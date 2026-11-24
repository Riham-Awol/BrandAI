import "server-only";
import { icons } from "lucide";
import { readableOn } from "@/modules/brand/color.js";
import { ICON_SET } from "@/modules/brand/catalog/icons.js";
import { loadFont } from "./fonts.js";

/**
 * Renders a logo concept (validated spec) to a self-contained SVG string.
 *
 * Safety: the output is built only from numbers, validated colours, Lucide
 * icon geometry and font outlines — text is converted to paths, so the only
 * text node is the escaped <title>. No user-controlled markup is emitted.
 */
const FONT_SIZE = 100;
const SHAPES = {
  circle: '<circle cx="50" cy="50" r="50"/>',
  rounded_square: '<rect width="100" height="100" rx="22"/>',
  squircle: '<rect width="100" height="100" rx="36"/>',
  hexagon: '<polygon points="50,0 93.3,25 93.3,75 50,100 6.7,75 6.7,25"/>',
  shield: '<path d="M50 0 L96 15 V47 C96 74 76 93 50 100 C24 93 4 74 4 47 V15 Z"/>',
  diamond: '<polygon points="50,0 100,50 50,100 0,50"/>',
};

const xml = (s) => String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (n) => Number(n.toFixed(2));

export function applyCase(text, letterCase) {
  if (letterCase === "upper") return text.toUpperCase();
  if (letterCase === "lower") return text.toLowerCase();
  if (letterCase === "title") return text.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return text;
}

function hasAllGlyphs(font, text) {
  return [...text].every((ch) => /\s/.test(ch) || font.charToGlyph(ch).index !== 0);
}

/**
 * Lays out text glyph by glyph (kerning + tracking). Glyphs are serialized
 * one by one (opentype.js 2.0 corrupts some coordinates when serializing a
 * combined path) and their bounding boxes merged.
 */
function textPath(font, text, size, tracking = 0) {
  const scale = size / font.unitsPerEm;
  const parts = [];
  const box = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
  let x = 0;
  let prev = null;
  const chars = [...text];
  chars.forEach((ch, i) => {
    const glyph = font.charToGlyph(ch);
    if (prev) x += (font.getKerningValue(prev, glyph) || 0) * scale;
    const path = glyph.getPath(x, 0, size);
    if (path.commands.length) parts.push(serializeCommands(path.commands, box));
    x += (glyph.advanceWidth || 0) * scale + (i < chars.length - 1 ? tracking * size : 0);
    prev = glyph;
  });
  if (!Number.isFinite(box.x1)) Object.assign(box, { x1: 0, y1: -size * 0.7, x2: Math.max(x, 1), y2: 0 });
  return { d: parts.join(""), box: { ...box, w: box.x2 - box.x1, h: box.y2 - box.y1 } };
}

/** Absolute-command SVG path serializer; also grows the bounding box (control points included). */
function serializeCommands(commands, box) {
  const f = (n) => (Number.isFinite(n) ? Number(n.toFixed(2)) : 0);
  const grow = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    box.x1 = Math.min(box.x1, x);
    box.y1 = Math.min(box.y1, y);
    box.x2 = Math.max(box.x2, x);
    box.y2 = Math.max(box.y2, y);
  };
  let d = "";
  for (const c of commands) {
    if (c.type === "M" || c.type === "L") {
      d += `${c.type}${f(c.x)} ${f(c.y)}`;
      grow(c.x, c.y);
    } else if (c.type === "Q") {
      d += `Q${f(c.x1)} ${f(c.y1)} ${f(c.x)} ${f(c.y)}`;
      grow(c.x1, c.y1);
      grow(c.x, c.y);
    } else if (c.type === "C") {
      d += `C${f(c.x1)} ${f(c.y1)} ${f(c.x2)} ${f(c.y2)} ${f(c.x)} ${f(c.y)}`;
      grow(c.x1, c.y1);
      grow(c.x2, c.y2);
      grow(c.x, c.y);
    } else if (c.type === "Z") {
      d += "Z";
    }
  }
  return d;
}

function iconMarkup(name, color, strokeWidth = 2) {
  const node = icons[name];
  if (!node) return "";
  const children = node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${xml(v)}"`).join(" ")}/>`)
    .join("");
  return `<g fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${children}</g>`;
}

function themeColors(concept, theme) {
  if (theme === "mono") return { bg: null, mark: "#17151c", fg: "#ffffff", text: "#17151c" };
  if (theme === "inverse") {
    const bg = concept.colors.mark;
    const on = readableOn(bg);
    return { bg, mark: on, fg: bg, text: on };
  }
  return { bg: null, mark: concept.colors.mark, fg: concept.colors.markForeground, text: concept.colors.text };
}

async function resolveFont(concept, text) {
  let font = await loadFont(concept.fontKey, concept.fontWeight);
  const warnings = [];
  if (!hasAllGlyphs(font, text)) {
    const fallback = await loadFont("inter", concept.fontWeight);
    if (hasAllGlyphs(fallback, text)) {
      font = fallback;
      warnings.push("Some characters are not in the selected font; Inter was used instead.");
    } else {
      warnings.push("Some characters are not supported by the bundled fonts (Latin only).");
    }
  }
  return { font, warnings };
}

/** Builds the mark (shape + icon or monogram) in a 100×100 box. */
async function markGroup(concept, colors, font, fallbackLetter) {
  const shape = concept.shape !== "none" ? SHAPES[concept.shape] : null;
  const inner = shape ? colors.fg : colors.mark;
  const parts = [];
  if (shape) parts.push(`<g fill="${colors.mark}">${shape}</g>`);

  const useIcon = concept.markType === "icon" && ICON_SET.has(concept.icon);
  if (useIcon) {
    const size = shape ? 56 : 92;
    const offset = (100 - size) / 2;
    parts.push(`<g transform="translate(${offset} ${offset}) scale(${num(size / 24)})">${iconMarkup(concept.icon, inner)}</g>`);
  } else {
    const letters = (concept.markType === "monogram" && concept.monogram ? concept.monogram : fallbackLetter).slice(0, 2);
    const glyphs = textPath(font, letters, 100);
    const target = shape ? 52 : 86;
    const k = Math.min(target / Math.max(glyphs.box.w, 1), target / Math.max(glyphs.box.h, 1));
    const tx = 50 - (glyphs.box.x1 + glyphs.box.w / 2) * k;
    const ty = 50 - (glyphs.box.y1 + glyphs.box.h / 2) * k;
    parts.push(`<path fill="${inner}" transform="translate(${num(tx)} ${num(ty)}) scale(${num(k)})" d="${glyphs.d}"/>`);
  }
  return parts.join("");
}

/**
 * @param {object} concept validated logo concept
 * @param {{ name: string, variant?: "horizontal"|"stacked"|"mark"|"wordmark", theme?: "color"|"mono"|"inverse", height?: number }} options
 */
export async function renderLogoSvg(concept, { name, variant = "horizontal", theme = "color", height } = {}) {
  const label = applyCase(name.trim() || "Brand", concept.letterCase);
  const { font, warnings } = await resolveFont(concept, label);
  const colors = themeColors(concept, theme);
  const tracking = Math.min(0.3, Math.max(-0.05, concept.letterSpacing ?? 0));

  // Name-only ("wordmark") concepts have no symbol: every layout except the
  // icon-only variant shows just the name; the icon variant uses the initial.
  const showMark = variant === "mark" || (variant !== "wordmark" && concept.markType !== "wordmark");
  const showText = variant !== "mark";
  const fallbackLetter = label.replace(/[^\p{L}\p{N}]/gu, "").charAt(0).toUpperCase() || "B";

  const text = showText ? textPath(font, label, FONT_SIZE, tracking) : null;
  const capHeight = font.tables.os2?.sCapHeight ? (font.tables.os2.sCapHeight / font.unitsPerEm) * FONT_SIZE : FONT_SIZE * 0.7;
  const markSize = variant === "stacked" ? capHeight * 2.4 : variant === "mark" ? 100 : capHeight * 1.9;

  let content = "";
  let width;
  let contentHeight;
  if (variant === "mark" || (showMark && !showText)) {
    content = `<g transform="scale(${num(markSize / 100)})">${await markGroup(concept, colors, font, fallbackLetter)}</g>`;
    width = markSize;
    contentHeight = markSize;
  } else if (variant === "wordmark" || !showMark) {
    content = `<path fill="${colors.text}" transform="translate(${num(-text.box.x1)} ${num(-text.box.y1)})" d="${text.d}"/>`;
    width = text.box.w;
    contentHeight = text.box.h;
  } else if (variant === "stacked") {
    const gap = markSize * 0.28;
    width = Math.max(markSize, text.box.w);
    const mx = (width - markSize) / 2;
    const tx = (width - text.box.w) / 2 - text.box.x1;
    const ty = markSize + gap - text.box.y1;
    content =
      `<g transform="translate(${num(mx)} 0) scale(${num(markSize / 100)})">${await markGroup(concept, colors, font, fallbackLetter)}</g>` +
      `<path fill="${colors.text}" transform="translate(${num(tx)} ${num(ty)})" d="${text.d}"/>`;
    contentHeight = markSize + gap + text.box.h;
  } else {
    const gap = markSize * 0.32;
    contentHeight = Math.max(markSize, text.box.h);
    const my = (contentHeight - markSize) / 2;
    const tx = markSize + gap - text.box.x1;
    const ty = (contentHeight - text.box.h) / 2 - text.box.y1;
    content =
      `<g transform="translate(0 ${num(my)}) scale(${num(markSize / 100)})">${await markGroup(concept, colors, font, fallbackLetter)}</g>` +
      `<path fill="${colors.text}" transform="translate(${num(tx)} ${num(ty)})" d="${text.d}"/>`;
    width = markSize + gap + text.box.w;
  }

  const pad = Math.max(width, contentHeight) * (colors.bg ? 0.14 : 0.06);
  const vbW = num(width + pad * 2);
  const vbH = num(contentHeight + pad * 2);
  const outH = height ?? Math.round(vbH);
  const outW = Math.round((vbW / vbH) * outH);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="${outW}" height="${outH}" role="img">` +
    `<title>${xml(name)} logo</title>` +
    (colors.bg ? `<rect width="${vbW}" height="${vbH}" fill="${colors.bg}"/>` : "") +
    `<g transform="translate(${num(pad)} ${num(pad)})">${content}</g></svg>`;
  return { svg, width: outW, height: outH, warnings };
}

/** Headers for serving generated SVG safely. */
export const SVG_HEADERS = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "private, max-age=60",
};
