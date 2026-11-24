import "server-only";
import { contrastRatio, normalizeHex, readableOn } from "@/modules/brand/color.js";
import { ICON_SET } from "@/modules/brand/catalog/icons.js";
import { DESIGN_FORMATS } from "@/modules/design/catalog.js";
import { loadFont } from "../brand/fonts.js";
import { iconMarkup, renderLogoSvg } from "../brand/logo-renderer.js";
import { fitText, hasAllGlyphs, measure, normalizeTypography, num, textBlock, xml } from "../brand/text.js";

/**
 * Renders a design spec to SVG using the approved brand (colours, fonts, logo).
 *
 * Safety: all text is converted to outlined paths; colours are validated hex
 * values; images are embedded only as data URIs of magic-byte-validated
 * uploads; icons come from Lucide geometry. No user markup is emitted.
 */

export const DEFAULT_BRAND = {
  name: "Your brand",
  colors: { primary: "#302442", secondary: "#b9a0d2", accent: "#e4572e", dark: "#17151c", light: "#efe9f5", background: "#ffffff" },
  heading: { fontKey: "fraunces", weight: "700" },
  body: { fontKey: "manrope", weight: "500" },
  logo: null,
};

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = (shift) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${[c(16), c(8), c(0)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Near-black or white, falling back to pure black/white (one always reaches ≥ 4.58:1). */
function bestOn(bg) {
  const ok = ["#17151c", "#ffffff"].find((c) => contrastRatio(c, bg) >= 4.5);
  return ok ?? (contrastRatio("#000000", bg) >= contrastRatio("#ffffff", bg) ? "#000000" : "#ffffff");
}

/** Text colour that is readable on `bg`, preferring `preferred` when contrast allows. */
function onColor(bg, preferred, min = 4.5) {
  if (preferred && contrastRatio(preferred, bg) >= min) return preferred;
  const fallback = readableOn(bg);
  return contrastRatio(fallback, bg) >= min ? fallback : bestOn(bg);
}

/** Resolves the colour scheme from brand colours, guaranteeing readable text. */
export function resolveColors(brandColors, scheme) {
  const c = Object.fromEntries(Object.entries(brandColors).map(([k, v]) => [k, normalizeHex(v) ?? DEFAULT_BRAND.colors[k]]));
  const bgByScheme = { light: c.background, dark: c.dark, primary: c.primary, accent: c.accent };
  const bg = bgByScheme[scheme] ?? c.background;
  const text = onColor(bg, scheme === "light" ? c.dark : c.light);
  const muted = mix(text, bg, 0.28);
  const highlight = [c.primary, c.accent, c.secondary, text].find((x) => x !== bg && contrastRatio(x, bg) >= 3) ?? text;
  const ctaBg = scheme === "light" ? c.primary : scheme === "dark" ? c.accent : text;
  const ctaFg = onColor(ctaBg, bg);
  const badgeBg = [c.accent, c.secondary, c.primary].find((x) => x !== bg && contrastRatio(x, bg) >= 1.5) ?? ctaBg;
  return {
    bg,
    text,
    muted: contrastRatio(muted, bg) >= 4.5 ? muted : text,
    highlight,
    ctaBg,
    ctaFg,
    badgeBg,
    badgeFg: onColor(badgeBg),
    soft: mix(bg, highlight, 0.14),
    band: scheme === "primary" || scheme === "accent" ? c.dark : c.primary,
    brand: c,
  };
}

async function fontFor(role, brand, text) {
  const pick = role === "heading" ? brand.heading : brand.body;
  const font = await loadFont(pick.fontKey, pick.weight);
  if (!text || hasAllGlyphs(font, text)) return font;
  return loadFont("inter", role === "heading" ? "700" : "500");
}

function placeSvg(svg, x, y, w, h, align = "left") {
  const aspect = { left: "xMinYMid", center: "xMidYMid", right: "xMaxYMid" }[align];
  return svg.replace(/^<svg /, `<svg x="${num(x)}" y="${num(y)}" preserveAspectRatio="${aspect} meet" `).replace(/ width="[^"]*" height="[^"]*"/, ` width="${num(w)}" height="${num(h)}"`);
}

/** Text items rendered top-to-bottom; sizes are in units of u = min(W,H)/100. */
const ITEM_STYLE = {
  eyebrow: { role: "body", size: 2.7, lines: 1, tracking: 0.12, color: "highlight", upper: true },
  headline: { role: "heading", size: 9, lines: 4, lineHeight: 1.04, color: "text" },
  subheadline: { role: "body", size: 4, lines: 3, color: "text" },
  body: { role: "body", size: 3.2, lines: 4, lineHeight: 1.35, color: "muted" },
  footer: { role: "body", size: 2.5, lines: 2, color: "muted" },
};

class Composer {
  constructor(spec, brand, colors, W, H) {
    this.spec = spec;
    this.brand = brand;
    this.colors = colors;
    this.W = W;
    this.H = H;
    this.u = Math.min(W, H) / 100;
    this.warnings = [];
  }

  async text(kind, value, { x, y, width, align = "left", scale = 1, color, maxLines }) {
    if (!value) return { svg: "", height: 0 };
    const style = ITEM_STYLE[kind];
    const content = style.upper ? value.toUpperCase() : value;
    const font = await fontFor(style.role, this.brand, content);
    const fitted = fitText(font, content, {
      maxWidth: width,
      maxLines: maxLines ?? style.lines,
      size: Math.max(7, style.size * this.u * scale),
      minSize: Math.max(7, style.size * this.u * scale * 0.55),
      lineHeight: style.lineHeight ?? 1.18,
      tracking: style.tracking ?? 0,
    });
    if (fitted.truncated) this.warnings.push(`The ${kind} was shortened to fit.`);
    return textBlock(font, fitted.lines, fitted.size, { x, y, width, align, lineHeight: style.lineHeight ?? 1.18, fill: color ?? this.colors[style.color], tracking: style.tracking ?? 0 });
  }

  async pill(label, { x, y, align = "left", width, scale = 1, bg, fg }) {
    if (!label) return { svg: "", height: 0, width: 0 };
    const font = await fontFor("body", this.brand, label);
    const size = Math.max(8, 3.3 * this.u * scale);
    const tw = Math.min(measure(font, label, size), (width ?? this.W) * 0.9);
    const padX = size * 1.1;
    const h = size * 2.3;
    const w = tw + padX * 2;
    const px = align === "center" ? x + (width - w) / 2 : x;
    const t = textBlock(font, [label], size, { x: px + padX, y: y + (h - size * 1.2) / 2 - size * 0.08, width: tw, fill: fg ?? this.colors.ctaFg });
    return { svg: `<rect x="${num(px)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="${num(h / 2)}" fill="${bg ?? this.colors.ctaBg}"/>${t.svg}`, height: h, width: w };
  }

  async badge(label, { cx, cy, r }) {
    if (!label) return "";
    const font = await fontFor("heading", this.brand, label);
    const fitted = fitText(font, label.toUpperCase(), { maxWidth: r * 1.45, maxLines: 2, size: r * 0.42, minSize: r * 0.18, lineHeight: 1 });
    const block = textBlock(font, fitted.lines, fitted.size, { x: cx - r, y: 0, width: r * 2, align: "center", lineHeight: 1, fill: this.colors.badgeFg });
    const top = cy - block.height / 2;
    return `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}" fill="${this.colors.badgeBg}"/>${textBlock(font, fitted.lines, fitted.size, { x: cx - r, y: top, width: r * 2, align: "center", lineHeight: 1, fill: this.colors.badgeFg }).svg}`;
  }

  async list({ x, y, width, scale = 1, align = "left" }) {
    const { bullets = [], details = [] } = this.spec;
    let svg = "";
    let h = 0;
    const font = await fontFor("body", this.brand, [...bullets, ...details.map((d) => `${d.label} ${d.value}`)].join(" "));
    const size = Math.max(7, 3.1 * this.u * scale);
    for (const b of bullets.slice(0, 4)) {
      const fitted = fitText(font, b, { maxWidth: width - size * 1.4, maxLines: 2, size, minSize: size * 0.7 });
      const block = textBlock(font, fitted.lines, fitted.size, { x: align === "center" ? x : x + size * 1.4, y: y + h, width: align === "center" ? width : width - size * 1.4, align, fill: this.colors.text });
      if (align !== "center") svg += `<circle cx="${num(x + size * 0.45)}" cy="${num(y + h + size * 0.62)}" r="${num(size * 0.22)}" fill="${this.colors.highlight}"/>`;
      svg += block.svg;
      h += block.height + size * 0.45;
    }
    for (const d of details.slice(0, 4)) {
      const label = textBlock(font, [d.label.toUpperCase()], size * 0.72, { x, y: y + h, width, align, fill: this.colors.muted, tracking: 0.08 });
      const valueFit = fitText(font, d.value, { maxWidth: width, maxLines: 2, size: size * 1.1, minSize: size * 0.75 });
      const value = textBlock(font, valueFit.lines, valueFit.size, { x, y: y + h + size * 0.95, width, align, fill: this.colors.text });
      svg += label.svg + value.svg;
      h += size * 0.95 + value.height + size * 0.55;
    }
    return { svg, height: h };
  }

  async logo({ x, y, w, h, background, variant = "horizontal", align = "left" }) {
    if (!this.spec.showLogo) return "";
    if (!this.brand.logo) {
      // No approved logo: the business name set in the heading font.
      const font = await fontFor("heading", this.brand, this.brand.name);
      const fitted = fitText(font, this.brand.name, { maxWidth: w, maxLines: 1, size: h * 0.55, minSize: Math.min(h * 0.3, 10) });
      const block = textBlock(font, fitted.lines, fitted.size, { x, y: 0, width: w, align, fill: this.colors.text });
      return `<g transform="translate(0 ${num(y + (h - block.height) / 2)})">${block.svg}</g>`;
    }
    const lc = this.brand.logo.colors;
    const theme = contrastRatio(lc.text, background) >= 3 && contrastRatio(lc.mark, background) >= 1.6 ? "color" : "knockout";
    const { svg } = await renderLogoSvg(this.brand.logo, { name: this.brand.name, variant, theme, background });
    return placeSvg(svg, x, y, w, h, align);
  }

  icon({ cx, cy, size, color, opacity = 1 }) {
    const name = this.spec.icon;
    if (!name || !ICON_SET.has(name)) return "";
    return `<g opacity="${opacity}" transform="translate(${num(cx - size / 2)} ${num(cy - size / 2)}) scale(${num(size / 24)})">${iconMarkup(name, color, 1.6)}</g>`;
  }

  /**
   * Main text stack. Tries large sizes first and shrinks until the content fits
   * `maxHeight` (grow-to-fill), then positions it vertically within the space.
   */
  async stack({ x, y, width, maxHeight, align = "left", valign = "top", include = ["eyebrow", "headline", "subheadline", "body", "list", "cta"], colors = {}, maxScale = 1.6 }) {
    const scales = [1.6, 1.45, 1.3, 1.18, 1.08, 1, 0.9, 0.8, 0.7, 0.62].filter((s) => s <= maxScale);
    // When even the smallest size overflows, optional items are dropped (least important first).
    const droppable = ["body", "list", "eyebrow", "subheadline"].filter((k) => include.includes(k));
    let items = include;
    let result = null;
    for (;;) {
      for (const scale of scales) {
        const before = this.warnings.length;
        const built = await this.buildStack({ x, y, width, align, items, colors, scale });
        const fits = !maxHeight || built.height <= maxHeight + 0.5;
        const truncated = this.warnings.length > before;
        if ((fits && !truncated) || scale === scales.at(-1)) {
          result = { ...built, fits };
          break;
        }
        this.warnings.length = before;
      }
      if (result.fits || !droppable.length) break;
      const drop = droppable.shift();
      if (this.hasContent(drop)) this.warnings.push(`The ${drop === "list" ? "points and details" : drop} didn't fit at this size and ${drop === "list" ? "were" : "was"} hidden.`);
      items = items.filter((k) => k !== drop);
    }
    if (!result.fits) this.warnings.push("There is a lot of text for this size; consider shortening it.");
    const free = maxHeight ? Math.max(0, maxHeight - result.height) : 0;
    const offset = valign === "center" ? free / 2 : valign === "bottom" ? free : valign === "upper" ? free * 0.35 : 0;
    return { svg: offset ? `<g transform="translate(0 ${num(offset)})">${result.svg}</g>` : result.svg, height: result.height, top: y + offset };
  }

  hasContent(item) {
    if (item === "list") return Boolean(this.spec.bullets?.length || this.spec.details?.length);
    return Boolean(this.spec[item]);
  }

  async buildStack({ x, y, width, align, items, colors, scale }) {
    let svg = "";
    let h = 0;
    const gap = 2.4 * this.u * Math.min(scale, 1.2);
    for (const item of items) {
      let block;
      if (item === "list") block = await this.list({ x, y: y + h, width, scale, align });
      else if (item === "cta") {
        const pill = await this.pill(this.spec.cta, { x, y: y + h + gap * 0.4, width, align, scale: Math.min(scale, 1.3) });
        block = { svg: pill.svg, height: pill.height ? pill.height + gap * 0.4 : 0 };
      } else block = await this.text(item, this.spec[item], { x, y: y + h, width, align, scale, color: colors[item] });
      if (block.height) {
        svg += block.svg;
        h += block.height + gap;
      }
    }
    return { svg, height: Math.max(0, h - gap) };
  }

  /** Footer line anchored to `bottom`. */
  async footer({ x, width, bottom, align = "left", color }) {
    const probe = await this.text("footer", this.spec.footer, { x, y: 0, width, align, color });
    if (!probe.height) return { svg: "", height: 0 };
    return this.text("footer", this.spec.footer, { x, y: bottom - probe.height, width, align, color });
  }
}

async function imageOrPlaceholder(cmp, { x, y, w, h, image, id }) {
  if (image) {
    return `<defs><clipPath id="${id}"><rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}"/></clipPath></defs><image href="${image}" x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`;
  }
  // No photo: a tinted panel with the brand icon (clearly a placeholder, not fake imagery).
  const fill = mix(cmp.colors.bg, cmp.colors.highlight, 0.2);
  return `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="${fill}"/>${cmp.icon({ cx: x + w / 2, cy: y + h / 2, size: Math.min(w, h) * 0.38, color: cmp.colors.highlight, opacity: 0.85 })}`;
}

const TEMPLATES = {
  async bold_headline(cmp, { W, H, u, pad }) {
    const c = cmp.colors;
    let svg = `<circle cx="${num(W * 0.92)}" cy="${num(H * 0.06)}" r="${num(Math.max(W, H) * 0.32)}" fill="${c.soft}"/>`;
    svg += cmp.icon({ cx: W - pad - 9 * u, cy: H - pad - 9 * u, size: 22 * u, color: c.highlight, opacity: 0.18 });
    const logoH = 9 * u;
    svg += await cmp.logo({ x: pad, y: pad, w: W * 0.45, h: logoH, background: c.bg });
    const footer = await cmp.footer({ x: pad, width: W * 0.7 - pad, bottom: H - pad });
    const top = pad + logoH + 4 * u;
    const badgeR = 10 * u;
    const block = await cmp.stack({ x: pad, y: top, width: W - pad * 2 - (cmp.spec.badge ? badgeR * 2 + 2 * u : 0), maxHeight: H - pad - footer.height - 4 * u - top, valign: "upper" });
    svg += block.svg + footer.svg;
    if (cmp.spec.badge) svg += await cmp.badge(cmp.spec.badge, { cx: W - pad - badgeR, cy: block.top + badgeR, r: badgeR });
    return svg;
  },

  async split_image(cmp, { W, H, u, pad, image }) {
    const landscape = W / H > 1.15;
    const imgShare = H / W > 1.25 ? 0.48 : 0.4;
    const imgBox = landscape ? { x: 0, y: 0, w: W * 0.46, h: H } : { x: 0, y: 0, w: W, h: H * imgShare };
    let svg = await imageOrPlaceholder(cmp, { ...imgBox, image, id: "img-split" });
    const area = landscape ? { x: W * 0.46 + pad, y: pad, w: W * 0.54 - pad * 2, h: H - pad * 2 } : { x: pad, y: imgBox.h + pad * 0.8, w: W - pad * 2, h: H - imgBox.h - pad * 1.8 };
    const logoH = 7 * u;
    svg += await cmp.logo({ x: area.x, y: area.y, w: area.w * 0.6, h: logoH, background: cmp.colors.bg });
    const footer = await cmp.footer({ x: area.x, width: area.w, bottom: area.y + area.h });
    const top = area.y + logoH + 3 * u;
    const block = await cmp.stack({ x: area.x, y: top, width: area.w, maxHeight: area.y + area.h - footer.height - 3 * u - top, valign: "center" });
    svg += block.svg + footer.svg;
    if (cmp.spec.badge) svg += await cmp.badge(cmp.spec.badge, { cx: imgBox.x + imgBox.w - 13 * u, cy: imgBox.y + 13 * u, r: 9.5 * u });
    return svg;
  },

  async centered_badge(cmp, { W, H, u, pad }) {
    const c = cmp.colors;
    let svg = "";
    const logoH = 8 * u;
    svg += await cmp.logo({ x: W * 0.25, y: pad, w: W * 0.5, h: logoH, background: c.bg, align: "center" });
    const footer = await cmp.footer({ x: pad, width: W - pad * 2, bottom: H - pad, align: "center" });
    let y = pad + logoH + 4 * u;
    const bottom = H - pad - footer.height - 3 * u;
    // Badge (or icon) + text are centred together in the space between logo and footer.
    const r = cmp.spec.badge ? 14 * u : cmp.spec.icon ? 8 * u : 0;
    const head = r ? r * 2 + 4 * u : 0;
    const block = await cmp.stack({ x: pad, y: y + head, width: W - pad * 2, maxHeight: bottom - y - head, align: "center" });
    const offset = Math.max(0, (bottom - y - head - block.height) / 2);
    let group = block.svg;
    if (cmp.spec.badge) group += await cmp.badge(cmp.spec.badge, { cx: W / 2, cy: y + r, r });
    else if (r) group += cmp.icon({ cx: W / 2, cy: y + r, size: r * 2, color: c.highlight });
    svg += `<g transform="translate(0 ${num(offset)})">${group}</g>` + footer.svg;
    return svg;
  },

  async minimal_frame(cmp, { W, H, u, pad }) {
    const c = cmp.colors;
    const inset = pad * 0.6;
    let svg = `<rect x="${num(inset)}" y="${num(inset)}" width="${num(W - inset * 2)}" height="${num(H - inset * 2)}" fill="none" stroke="${c.highlight}" stroke-width="${num(Math.max(1, 0.35 * u))}"/>`;
    const inner = pad * 1.5;
    const logoH = 7 * u;
    const footer = await cmp.footer({ x: inner, width: W - inner * 2, bottom: H - inner, align: "center" });
    const logoY = H - inner - footer.height - (footer.height ? 2 * u : 0) - logoH;
    const block = await cmp.stack({ x: inner, y: inner, width: W - inner * 2, maxHeight: logoY - inner - 6 * u, align: "center", valign: "center", maxScale: 1.3 });
    svg += block.svg;
    svg += `<rect x="${num(W / 2 - 6 * u)}" y="${num(block.top + block.height + 2.5 * u)}" width="${num(12 * u)}" height="${num(Math.max(1, 0.4 * u))}" fill="${c.highlight}"/>`;
    svg += await cmp.logo({ x: W * 0.25, y: logoY, w: W * 0.5, h: logoH, background: c.bg, align: "center" });
    return svg + footer.svg;
  },

  async diagonal_band(cmp, { W, H, u, pad }) {
    const c = cmp.colors;
    const band = c.band === c.bg ? c.highlight : c.band;
    const bandFg = onColor(band);
    const slope = H * 0.05;
    const logoH = 8 * u;
    const eyebrow = await cmp.text("eyebrow", cmp.spec.eyebrow, { x: pad, y: pad + logoH + 3 * u, width: W - pad * 2 });
    const top = pad + logoH + 3 * u + eyebrow.height + 3 * u + slope;
    const head = await cmp.stack({ x: pad, y: top + slope, width: W - pad * 2 - (cmp.spec.badge ? 16 * u : 0), maxHeight: H * 0.36, include: ["headline"], colors: { headline: bandFg }, maxScale: 1.45 });
    const bottom = top + slope * 2 + head.height + 2 * u;
    let svg = `<polygon points="0,${num(top + slope)} ${num(W)},${num(top - slope)} ${num(W)},${num(bottom - slope)} 0,${num(bottom + slope)}" fill="${band}"/>`;
    svg += await cmp.logo({ x: pad, y: pad, w: W * 0.45, h: logoH, background: c.bg });
    svg += eyebrow.svg + head.svg;
    const footer = await cmp.footer({ x: pad, width: W - pad * 2, bottom: H - pad });
    const lowerTop = bottom + slope + 3 * u;
    const lower = await cmp.stack({ x: pad, y: lowerTop, width: W - pad * 2, maxHeight: H - pad - footer.height - 3 * u - lowerTop, include: ["subheadline", "body", "list", "cta"], maxScale: 1.3 });
    svg += lower.svg + footer.svg;
    if (cmp.spec.badge) svg += await cmp.badge(cmp.spec.badge, { cx: W - pad - 9 * u, cy: top - slope, r: 9 * u });
    return svg;
  },

  async event_ticket(cmp, { W, H, u, pad }) {
    const c = cmp.colors;
    const headBg = c.band === c.bg ? c.highlight : c.band;
    const headFg = onColor(headBg);
    const iconSpace = cmp.spec.icon ? 16 * u : 0;
    const head = await cmp.stack({ x: pad, y: pad, width: W - pad * 2 - iconSpace, maxHeight: H * 0.42 - pad * 2, include: ["eyebrow", "headline", "subheadline"], colors: { eyebrow: headFg, headline: headFg, subheadline: headFg }, maxScale: 1.45 });
    const headerH = Math.max(H * 0.28, head.height + pad * 2);
    let svg = `<rect width="${num(W)}" height="${num(headerH)}" fill="${headBg}"/>`;
    svg += cmp.icon({ cx: W - pad - 7 * u, cy: pad + 7 * u, size: 14 * u, color: headFg, opacity: 0.35 });
    svg += head.svg;
    svg += `<line x1="${num(pad)}" y1="${num(headerH)}" x2="${num(W - pad)}" y2="${num(headerH)}" stroke="${c.bg}" stroke-width="${num(0.6 * u)}" stroke-dasharray="${num(2 * u)} ${num(1.5 * u)}"/>`;
    const footerH = 10 * u;
    const fy = H - pad - footerH;
    const y = headerH + pad * 0.8;
    const body = await cmp.stack({ x: pad, y, width: W - pad * 2 - (cmp.spec.badge ? 10 * u : 0), maxHeight: fy - 3 * u - y, include: ["list", "body"], valign: "center", maxScale: 1.45 });
    svg += body.svg;
    svg += `<line x1="${num(pad)}" y1="${num(fy - 1 * u)}" x2="${num(W - pad)}" y2="${num(fy - 1 * u)}" stroke="${c.muted}" stroke-width="${num(Math.max(1, 0.2 * u))}" stroke-dasharray="${num(1.5 * u)} ${num(1.2 * u)}"/>`;
    const pill = await cmp.pill(cmp.spec.cta, { x: pad, y: 0, scale: 1.1 });
    if (pill.height) svg += `<g transform="translate(0 ${num(fy + (footerH - pill.height) / 2 + 1 * u)})">${pill.svg}</g>`;
    svg += await cmp.logo({ x: W * 0.5, y: fy + 1.5 * u, w: W * 0.5 - pad, h: footerH - 1 * u, background: c.bg, align: "right" });
    if (cmp.spec.badge) svg += await cmp.badge(cmp.spec.badge, { cx: W - pad - 9 * u, cy: headerH, r: 9 * u });
    return svg;
  },
};

/** Very wide formats (e.g. 728×90): one horizontal row regardless of template. */
async function strip(cmp, { W, H }) {
  const c = cmp.colors;
  const pad = H * 0.16;
  let x = pad;
  let svg = "";
  if (cmp.spec.showLogo && cmp.brand.logo) {
    svg += await cmp.logo({ x, y: pad, w: H - pad * 2, h: H - pad * 2, background: c.bg, variant: "mark" });
    x += H - pad * 2 + pad;
  }
  const cta = cmp.spec.cta ? await cmp.pill(cmp.spec.cta, { x: 0, y: 0, scale: (H * 0.3) / (3.3 * cmp.u) / 2.3 }) : { width: 0 };
  const ctaW = cta.width;
  const badgeW = cmp.spec.badge ? H * 0.8 : 0;
  const textW = W - x - ctaW - badgeW - pad * 3;
  const headFont = await fontFor("heading", cmp.brand, cmp.spec.headline);
  const fitted = fitText(headFont, cmp.spec.headline, { maxWidth: textW, maxLines: 2, size: H * 0.3, minSize: H * 0.16, lineHeight: 1.05 });
  const head = textBlock(headFont, fitted.lines, fitted.size, { x, y: 0, width: textW, lineHeight: 1.05, fill: c.text });
  let subH = 0;
  let subSvg = "";
  if (cmp.spec.subheadline && fitted.lines.length === 1) {
    const bodyFont = await fontFor("body", cmp.brand, cmp.spec.subheadline);
    const sf = fitText(bodyFont, cmp.spec.subheadline, { maxWidth: textW, maxLines: 1, size: H * 0.17, minSize: H * 0.12 });
    const sb = textBlock(bodyFont, sf.lines, sf.size, { x, y: 0, width: textW, fill: c.muted });
    subH = sb.height + H * 0.04;
    subSvg = sb.svg;
  }
  const blockTop = (H - head.height - subH) / 2;
  svg += `<g transform="translate(0 ${num(blockTop)})">${head.svg}${subSvg ? `<g transform="translate(0 ${num(head.height + H * 0.04)})">${subSvg}</g>` : ""}</g>`;
  if (cmp.spec.badge) svg += await cmp.badge(cmp.spec.badge, { cx: W - pad - ctaW - pad - badgeW / 2, cy: H / 2, r: badgeW / 2 });
  if (cmp.spec.cta) {
    const pill = await cmp.pill(cmp.spec.cta, { x: W - pad - ctaW, y: 0, scale: (H * 0.3) / (3.3 * cmp.u) / 2.3 });
    svg += `<g transform="translate(0 ${num((H - pill.height) / 2)})">${pill.svg}</g>`;
  }
  return svg;
}

/**
 * @param {{ spec, format, brand?, image?: string|null, scale?: number }} input
 * `image` must be a data URI produced by the design service from a validated upload.
 */
/** Deep-normalizes every string of the spec for rendering. */
function cleanSpec(value) {
  if (typeof value === "string") return normalizeTypography(value);
  if (Array.isArray(value)) return value.map(cleanSpec);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanSpec(v)]));
  return value;
}

export async function renderDesignSvg({ spec: rawSpec, format, brand = DEFAULT_BRAND, image = null, scale = 1 }) {
  const spec = cleanSpec(rawSpec);
  const { width: W, height: H } = DESIGN_FORMATS[format];
  const colors = resolveColors(brand.colors, spec.colorScheme);
  const cmp = new Composer(spec, brand, colors, W, H);
  const u = cmp.u;
  const pad = Math.max(6, 7 * u);
  const body = W / H > 3 ? await strip(cmp, { W, H }) : await (TEMPLATES[spec.template] ?? TEMPLATES.bold_headline)(cmp, { W, H, u, pad, image });
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${Math.round(W * scale)}" height="${Math.round(H * scale)}" role="img">` +
    `<title>${xml(spec.headline || spec.name || "Design")}</title>` +
    `<rect width="${W}" height="${H}" fill="${colors.bg}"/>${body}</svg>`;
  return { svg, width: W, height: H, warnings: [...new Set(cmp.warnings)] };
}

export const DESIGN_SVG_HEADERS = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "private, max-age=30",
};
