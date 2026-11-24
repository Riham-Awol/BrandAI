import "server-only";
import { contrastRatio, normalizeHex, readableOn } from "@/modules/brand/color.js";
import { ICON_SET } from "@/modules/brand/catalog/icons.js";
import { DEFAULT_BRAND } from "../design/renderer.js";
import { loadFont } from "../brand/fonts.js";
import { iconMarkup, renderLogoSvg } from "../brand/logo-renderer.js";
import { fitText, hasAllGlyphs, measure, normalizeTypography, num, textBlock } from "../brand/text.js";

/**
 * Shared vector drawing helpers for stationery and merchandise. Everything is
 * built from validated data: text becomes outlined paths, colours are hex
 * values, logos come from the approved (validated) logo concept.
 */

export function brandColors(brand) {
  return Object.fromEntries(Object.keys(DEFAULT_BRAND.colors).map((k) => [k, normalizeHex(brand?.colors?.[k]) ?? DEFAULT_BRAND.colors[k]]));
}

export function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `#${[c(16), c(8), c(0)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Readable text colour on `bg`, preferring `preferred` when it passes `min` contrast. */
export function readable(bg, preferred, min = 4.5) {
  if (preferred && contrastRatio(preferred, bg) >= min) return preferred;
  for (const c of ["#17151c", "#ffffff", "#000000"]) if (contrastRatio(c, bg) >= min) return c;
  return contrastRatio("#000000", bg) > contrastRatio("#ffffff", bg) ? "#000000" : "#ffffff";
}

export async function fontFor(brand, role, text) {
  const pick = role === "heading" ? brand.heading ?? DEFAULT_BRAND.heading : brand.body ?? DEFAULT_BRAND.body;
  const font = await loadFont(pick.fontKey, pick.weight);
  if (!text || hasAllGlyphs(font, text)) return font;
  return loadFont("inter", role === "heading" ? "700" : "500");
}

/**
 * Fitted text block. Returns { svg, height, size }. `y` is the top of the block.
 */
export async function text(brand, role, value, { x, y, width, size, minSize, maxLines = 1, align = "left", fill, lineHeight = 1.18, tracking = 0, upper = false }) {
  const raw = normalizeTypography(String(value ?? "").trim());
  if (!raw) return { svg: "", height: 0, size: 0 };
  const content = upper ? raw.toUpperCase() : raw;
  const font = await fontFor(brand, role, content);
  const fitted = fitText(font, content, { maxWidth: width, maxLines, size, minSize: minSize ?? size * 0.6, lineHeight, tracking });
  const block = textBlock(font, fitted.lines, fitted.size, { x, y, width, align, lineHeight, fill, tracking });
  return { ...block, size: fitted.size, truncated: fitted.truncated };
}

export async function textWidth(brand, role, value, size) {
  const font = await fontFor(brand, role, value);
  return measure(font, normalizeTypography(value), size);
}

/** Places a standalone SVG string into a box (keeps aspect ratio). */
export function place(svg, { x, y, w, h, align = "center" }) {
  const aspect = { left: "xMinYMid", center: "xMidYMid", right: "xMaxYMid", top: "xMidYMin" }[align] ?? "xMidYMid";
  return svg
    .replace(/^<svg /, `<svg x="${num(x)}" y="${num(y)}" preserveAspectRatio="${aspect} meet" `)
    .replace(/ width="[^"]*" height="[^"]*"/, ` width="${num(w)}" height="${num(h)}"`)
    .replace(/<title>[\s\S]*?<\/title>/, "");
}

export function icon(name, { cx, cy, size, color, stroke = 1.75, opacity = 1 }) {
  if (!name || !ICON_SET.has(name)) return "";
  return `<g opacity="${opacity}" transform="translate(${num(cx - size / 2)} ${num(cy - size / 2)}) scale(${num(size / 24)})">${iconMarkup(name, color, stroke)}</g>`;
}

/**
 * The brand's logo in a box. `variant`: horizontal | stacked | mark | wordmark.
 * On backgrounds where the logo's own colours don't read, a one-colour
 * ("knockout") version is used. Without an approved logo: the name (or its
 * initial in a circle for the mark).
 */
export async function logo(brand, { variant = "horizontal", background, x, y, w, h, align = "center", color }) {
  const name = brand.name || "Brand";
  if (!brand.logo) {
    const ink = color ?? readable(background ?? "#ffffff");
    if (variant === "mark") {
      const r = Math.min(w, h) / 2;
      const cx = align === "left" ? x + r : align === "right" ? x + w - r : x + w / 2;
      const initial = await text(brand, "heading", name.replace(/[^\p{L}\p{N}]/gu, "").charAt(0).toUpperCase() || "B", { x: cx - r, y: 0, width: r * 2, size: r * 1.1, align: "center", fill: background ?? "#ffffff" });
      return `<circle cx="${num(cx)}" cy="${num(y + h / 2)}" r="${num(r)}" fill="${ink}"/><g transform="translate(0 ${num(y + h / 2 - initial.height / 2)})">${initial.svg}</g>`;
    }
    // Size from both box dimensions so long names shrink to fit instead of being cut.
    const t = await text(brand, "heading", name, { x, y: 0, width: w, size: Math.min(h * 0.62, w * 0.22), minSize: Math.min(h * 0.12, w * 0.04), align, fill: ink, maxLines: variant === "stacked" || h / w > 0.5 ? 2 : 1 });
    return `<g transform="translate(0 ${num(y + (h - t.height) / 2)})">${t.svg}</g>`;
  }
  const lc = brand.logo.colors;
  const bg = background ?? "#ffffff";
  if (color) {
    // One print colour (screen printing / embroidery): knockout logo with its ink recoloured;
    // inner details stay in the background colour.
    const { svg } = await renderLogoSvg(brand.logo, { name, variant, theme: "knockout", background: bg });
    const on = readableOn(bg).toLowerCase();
    return place(svg.replace(new RegExp(`(fill|stroke)="${on}"`, "gi"), `$1="${color}"`), { x, y, w, h, align });
  }
  const usesOwn = contrastRatio(lc.text, bg) >= 3 && contrastRatio(lc.mark, bg) >= 1.6;
  const { svg } = await renderLogoSvg(brand.logo, { name, variant, theme: usesOwn ? "color" : "knockout", background: bg });
  return place(svg, { x, y, w, h, align });
}

/** Lines of contact info with small icons. Returns { svg, height }. */
export async function contactLines(brand, lines, { x, y, width, size, fill, iconColor, align = "left", gap = 0.55 }) {
  let svg = "";
  let h = 0;
  for (const line of lines.filter((l) => l.value)) {
    const indent = line.icon && align === "left" ? size * 1.6 : 0;
    const t = await text(brand, "body", line.value, { x: x + indent, y: y + h, width: width - indent, size, minSize: size * 0.75, fill, align });
    if (indent) svg += icon(line.icon, { cx: x + size * 0.6, cy: y + h + size * 0.62, size: size * 1.05, color: iconColor ?? fill, stroke: 2 });
    svg += t.svg;
    h += t.height + size * gap;
  }
  return { svg, height: Math.max(0, h - size * gap) };
}

/** Physical-size SVG document: viewBox in tenths of a millimetre. */
export function doc({ widthMm, heightMm, body, title, background }) {
  const W = Math.round(widthMm * 10);
  const H = Math.round(heightMm * 10);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${widthMm}mm" height="${heightMm}mm" role="img">` +
    `<title>${String(title).replace(/[<>&"']/g, "")}</title>` +
    (background ? `<rect width="${W}" height="${H}" fill="${background}"/>` : "") +
    `${body}</svg>`
  );
}

/** Pixel-size SVG (mockups). */
export function pixelDoc({ width, height, body, title, background }) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">` +
    `<title>${String(title).replace(/[<>&"']/g, "")}</title>` +
    (background ? `<rect width="${width}" height="${height}" fill="${background}"/>` : "") +
    `${body}</svg>`
  );
}
