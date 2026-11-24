import "server-only";
import { contrastRatio } from "@/modules/brand/color.js";
import { addressLines, websiteLabel } from "@/modules/stationery/details.js";
import { DEFAULT_BRAND, resolveColors } from "../design/renderer.js";
import { num } from "../brand/text.js";
import { brandColors, contactLines, doc, icon, logo, mix, pixelDoc, readable, text } from "./draw.js";

/**
 * Renders branded stationery and merchandise from a validated spec, the
 * approved brand and the business details. Returns one or more views:
 * print files at physical size (mm) and product mockups.
 */

// ── Business cards (85 × 55 mm + 3 mm bleed; units = 0.1 mm) ───────────────

const CARD = { W: 910, H: 610, bleed: 30, safe: 80 };

function cardContact(spec, details) {
  const lines = [
    { icon: "Phone", value: spec.person.phone || details.phone },
    { icon: "Mail", value: spec.person.email || details.email },
  ];
  if (spec.showDetails) {
    lines.push({ icon: "Globe", value: websiteLabel(details.website) });
    lines.push({ icon: "MapPin", value: addressLines(details).slice(0, 2).join(", ") });
  }
  return lines;
}

async function cardFront(spec, brand, details) {
  const { W, H, safe } = CARD;
  const paper = brandColors(brand).background;
  const ink = readable(paper, brandColors(brand).dark);
  const muted = readable(paper, mix(ink, paper, 0.35));
  const accent = resolveColors(brand.colors, "light").highlight;
  const way = resolveColors(brand.colors, spec.colorway === "light" ? "primary" : spec.colorway);
  let body = "";
  if (spec.template === "split") {
    const band = 330;
    body += `<rect width="${band}" height="${H}" fill="${way.bg}"/>`;
    body += await logo(brand, { variant: "mark", background: way.bg, x: 60, y: H / 2 - 110, w: band - 90, h: 220 });
    const x = band + 60;
    const width = W - x - safe;
    const name = await text(brand, "heading", spec.person.name, { x, y: safe + 10, width, size: 44, minSize: 30, fill: ink });
    const title = await text(brand, "body", spec.person.title, { x, y: safe + 20 + name.height, width, size: 26, fill: accent });
    const lines = await contactLines(brand, cardContact(spec, details), { x, y: 0, width, size: 23, fill: muted, iconColor: accent });
    body += name.svg + title.svg + `<g transform="translate(0 ${num(H - safe - lines.height)})">${lines.svg}</g>`;
  } else if (spec.template === "centered") {
    body += await logo(brand, { variant: "stacked", background: paper, x: safe, y: safe, w: W - safe * 2, h: 210 });
    const name = await text(brand, "heading", spec.person.name, { x: safe, y: 330, width: W - safe * 2, size: 40, minSize: 28, fill: ink, align: "center" });
    const title = await text(brand, "body", spec.person.title, { x: safe, y: 340 + name.height, width: W - safe * 2, size: 24, fill: accent, align: "center", upper: true, tracking: 0.08 });
    const info = cardContact(spec, details).map((l) => l.value).filter(Boolean).slice(0, 3).join("  ·  ");
    const line = await text(brand, "body", info, { x: safe, y: 0, width: W - safe * 2, size: 21, minSize: 15, maxLines: 2, fill: muted, align: "center" });
    body += name.svg + title.svg + `<g transform="translate(0 ${num(H - safe - line.height)})">${line.svg}</g>`;
  } else {
    body += await logo(brand, { variant: "horizontal", background: paper, x: safe, y: safe, w: 460, h: 115, align: "left" });
    body += `<rect x="${safe}" y="${safe + 150}" width="60" height="5" fill="${accent}"/>`;
    const name = await text(brand, "heading", spec.person.name, { x: safe, y: safe + 185, width: W - safe * 2, size: 42, minSize: 30, fill: ink });
    const title = await text(brand, "body", spec.person.title, { x: safe, y: safe + 195 + name.height, width: W - safe * 2, size: 25, fill: muted });
    const lines = await contactLines(brand, cardContact(spec, details), { x: safe, y: 0, width: W - safe * 2, size: 22, fill: ink, iconColor: accent });
    body += name.svg + title.svg + `<g transform="translate(0 ${num(H - safe - lines.height)})">${lines.svg}</g>`;
  }
  return doc({ widthMm: 91, heightMm: 61, title: `${brand.name} business card (front)`, background: paper, body });
}

async function cardBack(spec, brand) {
  const { W, H, safe } = CARD;
  const way = resolveColors(brand.colors, spec.colorway);
  let body = "";
  const tag = spec.tagline ? await text(brand, "body", spec.tagline, { x: safe, y: 0, width: W - safe * 2, size: 26, minSize: 18, maxLines: 2, align: "center", fill: way.muted }) : { svg: "", height: 0 };
  const variant = spec.template === "centered" ? "mark" : "stacked";
  const lh = variant === "mark" ? 200 : 230;
  const top = (H - lh - (tag.height ? tag.height + 40 : 0)) / 2;
  body += await logo(brand, { variant, background: way.bg, x: safe, y: top, w: W - safe * 2, h: lh });
  if (tag.height) body += `<g transform="translate(0 ${num(top + lh + 40)})">${tag.svg}</g>`;
  return doc({ widthMm: 91, heightMm: 61, title: `${brand.name} business card (back)`, background: way.bg, body });
}

// ── Letterhead (A4) ─────────────────────────────────────────────────────────

async function letterhead(spec, brand, details) {
  const W = 2100;
  const H = 2970;
  const m = 200;
  const paper = "#ffffff";
  const c = brandColors(brand);
  const ink = readable(paper, c.dark);
  const muted = readable(paper, mix(ink, paper, 0.35));
  const accent = resolveColors(c, "light").highlight;
  const way = resolveColors(c, spec.colorway === "light" ? "primary" : spec.colorway);
  const info = [
    ...addressLines(details),
    details.phone,
    details.email,
    websiteLabel(details.website),
  ].filter(Boolean);
  const legal = [details.legalName || brand.name, spec.showRegistration && details.registrationNumber && `Company no. ${details.registrationNumber}`, spec.showRegistration && details.taxNumber && `Tax no. ${details.taxNumber}`].filter(Boolean).join("  ·  ");
  let body = "";
  let left = m;
  if (spec.template === "side_band") {
    body += `<rect width="140" height="${H}" fill="${way.bg}"/>`;
    left = 260;
  }
  if (spec.template === "centered") {
    body += await logo(brand, { variant: "stacked", background: paper, x: m, y: 150, w: W - m * 2, h: 300 });
    const line = await text(brand, "body", info.join("  ·  "), { x: m, y: 490, width: W - m * 2, size: 30, minSize: 22, maxLines: 2, align: "center", fill: muted });
    body += line.svg + `<rect x="${W / 2 - 150}" y="${num(540 + line.height)}" width="300" height="5" fill="${accent}"/>`;
  } else {
    body += await logo(brand, { variant: "horizontal", background: paper, x: left, y: 170, w: 760, h: 220, align: "left" });
    const block = await contactLines(brand, info.map((value) => ({ value })), { x: 1200, y: 180, width: W - m - 1200, size: 31, fill: muted, align: "right", gap: 0.4 });
    body += block.svg + `<rect x="${left}" y="${Math.max(450, 200 + block.height + 50)}" width="${W - m - left}" height="4" fill="${accent}"/>`;
  }
  const footerLines = [legal, spec.footerNote].filter(Boolean);
  let fy = H - 150;
  for (const line of [...footerLines].reverse()) {
    const t = await text(brand, "body", line, { x: left, y: 0, width: W - m - left, size: 26, minSize: 20, align: spec.template === "centered" ? "center" : "left", fill: muted });
    fy -= t.height;
    body += `<g transform="translate(0 ${num(fy)})">${t.svg}</g>`;
    fy -= 14;
  }
  body += `<rect x="${left}" y="${num(fy - 26)}" width="${W - m - left}" height="2" fill="${mix(paper, ink, 0.2)}"/>`;
  return doc({ widthMm: 210, heightMm: 297, title: `${brand.name} letterhead`, background: paper, body });
}

// ── Merchandise ─────────────────────────────────────────────────────────────

export function productHex(key, brand) {
  const c = brandColors(brand);
  return { white: "#ffffff", black: "#1c1b1f", natural: "#efe6d4", primary: c.primary, secondary: c.secondary, dark: c.dark, light: c.light }[key] ?? "#ffffff";
}

/** Ink for printing on a product colour: a brand colour with ≥ 3:1 contrast, else black/white. */
export function inkFor(productColor, brand) {
  const c = brandColors(brand);
  const candidates = contrastRatio(productColor, "#ffffff") > contrastRatio(productColor, "#000000") ? [c.light, c.background, c.secondary, "#ffffff"] : [c.primary, c.dark, c.accent, "#17151c"];
  return candidates.find((x) => contrastRatio(x, productColor) >= 3) ?? readable(productColor);
}

/** The artwork for merch, drawn in a box. Full-colour logo only on light products where it reads. */
async function artwork(spec, brand, { x, y, w, h, product }) {
  const ink = inkFor(product, brand);
  const fullColour = brand.logo && contrastRatio(brand.logo.colors.text, product) >= 3 && contrastRatio(brand.logo.colors.mark, product) >= 2;
  const opts = { background: product, color: fullColour ? undefined : ink };
  const slogan = spec.slogan || brand.name;
  switch (spec.artwork) {
    case "logo_mark":
      return logo(brand, { ...opts, variant: "mark", x, y, w, h });
    case "wordmark":
      return logo(brand, { ...opts, variant: "wordmark", x, y, w, h });
    case "slogan": {
      const t = await text(brand, "heading", slogan, { x, y: 0, width: w, size: Math.min(h * 0.32, w * 0.16), minSize: h * 0.08, maxLines: 3, align: "center", fill: ink, lineHeight: 1.05 });
      return `<g transform="translate(0 ${num(y + (h - t.height) / 2)})">${t.svg}</g>`;
    }
    case "slogan_logo": {
      const markH = h * 0.42;
      const t = await text(brand, "heading", slogan, { x, y: 0, width: w, size: Math.min(h * 0.18, w * 0.12), minSize: h * 0.06, maxLines: 2, align: "center", fill: ink, lineHeight: 1.05 });
      const total = markH + h * 0.06 + t.height;
      const top = y + (h - total) / 2;
      return (await logo(brand, { ...opts, variant: "mark", x, y: top, w, h: markH })) + `<g transform="translate(0 ${num(top + markH + h * 0.06)})">${t.svg}</g>`;
    }
    case "pattern": {
      const name = brand.logo?.icon || "Sparkles";
      const cols = Math.max(3, Math.round(w / (Math.min(w, h) / 4)));
      const rows = Math.max(3, Math.round(h / (w / cols)));
      const cw = w / cols;
      const ch = h / rows;
      let out = "";
      for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++) {
        if ((r + col) % 2) continue;
        out += icon(name, { cx: x + cw * (col + 0.5), cy: y + ch * (r + 0.5), size: Math.min(cw, ch) * 0.6, color: ink, stroke: 1.75 });
      }
      return out;
    }
    default:
      return logo(brand, { ...opts, variant: w / h > 1.6 ? "horizontal" : "stacked", x, y, w, h });
  }
}

const SHAPES = {
  tee: "M372 118 C410 168 590 168 628 118 L792 168 C830 182 858 205 875 236 L948 368 L838 428 L768 330 L768 902 C590 924 410 924 232 902 L232 330 L162 428 L52 368 L125 236 C142 205 170 182 208 168 Z",
  bag: "M250 330 H750 V880 C750 895 738 905 725 905 H275 C262 905 250 895 250 880 Z",
  mug: "M270 300 H690 V760 C690 820 640 850 580 850 H380 C320 850 270 820 270 760 Z",
};

const PRINT_AREAS = {
  TSHIRT: { left_chest: { box: [565, 245, 120, 120], mm: [90, 90] }, center_chest: { box: [370, 250, 260, 160], mm: [250, 150] }, full_front: { box: [340, 250, 320, 420], mm: [300, 400] }, back: { box: [340, 230, 320, 380], mm: [300, 350] } },
  UNIFORM: { left_chest: { box: [560, 270, 110, 100], mm: [90, 80] }, back: { box: [350, 240, 300, 300], mm: [300, 300] } },
  BAG: { center: { box: [310, 420, 380, 400], mm: [280, 300] }, lower: { box: [310, 640, 380, 200], mm: [280, 150] } },
  MUG: { front: { box: [320, 390, 320, 320], mm: [90, 80] }, wrap: { box: [285, 400, 390, 300], mm: [200, 85] } },
};

function shading(id, path) {
  return (
    `<defs><linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/><stop offset="0.45" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.14"/></linearGradient></defs>` +
    `<path d="${path}" fill="url(#${id})"/>`
  );
}

async function merchMockup(kind, spec, brand) {
  const product = productHex(spec.productColor, brand);
  const outline = mix(product, "#000000", 0.3);
  const area = PRINT_AREAS[kind][spec.placement] ?? Object.values(PRINT_AREAS[kind])[0];
  const [x, y, w, h] = area.box;
  let body = `<rect width="1000" height="1000" fill="#f3f1f5"/>`;
  if (kind === "TSHIRT" || kind === "UNIFORM") {
    body += `<path d="${SHAPES.tee}" fill="${product}" stroke="${outline}" stroke-width="3" stroke-linejoin="round"/>`;
    body += shading("shade-tee", SHAPES.tee);
    if (spec.placement === "back") body += `<path d="M380 118 C420 142 580 142 620 118" fill="none" stroke="${outline}" stroke-width="10" stroke-linecap="round"/>`;
    else if (kind === "UNIFORM") {
      const collar = mix(product, "#000000", 0.12);
      body += `<path d="M372 118 L462 210 L500 150 Z M628 118 L538 210 L500 150 Z" fill="${collar}" stroke="${outline}" stroke-width="3" stroke-linejoin="round"/>`;
      body += `<rect x="487" y="150" width="26" height="170" fill="${collar}" stroke="${outline}" stroke-width="2"/><circle cx="500" cy="210" r="6" fill="${outline}"/><circle cx="500" cy="270" r="6" fill="${outline}"/>`;
    } else body += `<path d="M372 118 C410 168 590 168 628 118" fill="none" stroke="${outline}" stroke-width="14" stroke-linecap="round"/>`;
  } else if (kind === "BAG") {
    const strap = mix(product, "#000000", 0.08);
    body += `<path d="M360 345 C360 120 450 120 450 345 M550 345 C550 120 640 120 640 345" fill="none" stroke="${strap}" stroke-width="28" stroke-linecap="round"/>`;
    body += `<path d="${SHAPES.bag}" fill="${product}" stroke="${outline}" stroke-width="3"/>` + shading("shade-bag", SHAPES.bag);
  } else {
    body += `<path d="M690 410 C835 410 835 660 690 660" fill="none" stroke="${product}" stroke-width="46"/><path d="M690 410 C835 410 835 660 690 660" fill="none" stroke="${outline}" stroke-width="2" opacity="0.6"/>`;
    body += `<path d="${SHAPES.mug}" fill="${product}" stroke="${outline}" stroke-width="3"/>` + shading("shade-mug", SHAPES.mug);
    body += `<ellipse cx="480" cy="300" rx="210" ry="32" fill="${mix(product, "#000000", 0.18)}" stroke="${outline}" stroke-width="3"/>`;
  }
  body += await artwork(spec, brand, { x, y, w, h, product });
  return pixelDoc({ width: 1000, height: 1000, title: `${brand.name} ${kind.toLowerCase()} mockup`, body });
}

async function merchArtworkFile(kind, spec, brand) {
  const product = productHex(spec.productColor, brand);
  const area = PRINT_AREAS[kind][spec.placement] ?? Object.values(PRINT_AREAS[kind])[0];
  const [mw, mh] = area.mm;
  const body = await artwork(spec, brand, { x: 0, y: 0, w: mw * 10, h: mh * 10, product });
  return { svg: doc({ widthMm: mw, heightMm: mh, title: `${brand.name} print artwork`, body }), widthMm: mw, heightMm: mh, product };
}

// ── Labels ──────────────────────────────────────────────────────────────────

async function label(spec, brand) {
  const way = resolveColors(brand.colors, spec.colorway);
  const name = spec.productName || brand.name;
  const facts = spec.details.filter((d) => d.label && d.value);
  const cut = `stroke="#9a9aa0" stroke-width="3" stroke-dasharray="14 10" fill="none"`;
  let body = "";
  let size;
  if (spec.template === "round") {
    size = [60, 60];
    body += `<circle cx="300" cy="300" r="300" fill="${way.bg}"/><circle cx="300" cy="300" r="262" fill="none" stroke="${way.highlight}" stroke-width="4"/>`;
    body += await logo(brand, { variant: "mark", background: way.bg, x: 230, y: 80, w: 140, h: 110 });
    const n = await text(brand, "heading", name, { x: 110, y: 215, width: 380, size: 62, minSize: 34, maxLines: 2, align: "center", fill: way.text, lineHeight: 1.05 });
    const d = await text(brand, "body", spec.descriptor, { x: 120, y: 230 + n.height, width: 360, size: 28, minSize: 20, maxLines: 2, align: "center", fill: way.muted });
    const f = await text(brand, "body", facts.slice(0, 2).map((x) => `${x.label}: ${x.value}`).join("  ·  "), { x: 150, y: 460, width: 300, size: 22, minSize: 16, maxLines: 2, align: "center", fill: way.text });
    body += n.svg + d.svg + f.svg + `<circle cx="300" cy="300" r="298" ${cut}/>`;
  } else if (spec.template === "tag") {
    size = [50, 90];
    body += `<rect width="500" height="900" rx="40" fill="${way.bg}"/><circle cx="250" cy="80" r="26" fill="#ffffff" stroke="${way.highlight}" stroke-width="4"/>`;
    body += await logo(brand, { variant: "stacked", background: way.bg, x: 70, y: 150, w: 360, h: 200 });
    const n = await text(brand, "heading", name, { x: 50, y: 400, width: 400, size: 54, minSize: 30, maxLines: 2, align: "center", fill: way.text, lineHeight: 1.05 });
    const d = await text(brand, "body", spec.descriptor, { x: 60, y: 415 + n.height, width: 380, size: 26, minSize: 18, maxLines: 3, align: "center", fill: way.muted });
    body += n.svg + d.svg;
    const lines = await contactLines(brand, facts.slice(0, 4).map((x) => ({ value: `${x.label}: ${x.value}` })), { x: 60, y: 0, width: 380, size: 22, fill: way.text, align: "center", gap: 0.35 });
    body += `<g transform="translate(0 ${num(840 - lines.height)})">${lines.svg}</g>`;
    if (spec.tagline) body += (await text(brand, "body", spec.tagline, { x: 60, y: 560 + n.height, width: 380, size: 24, maxLines: 2, align: "center", fill: way.highlight })).svg;
    body += `<rect x="2" y="2" width="496" height="896" rx="40" ${cut}/>`;
  } else {
    size = [90, 60];
    body += `<rect width="900" height="600" rx="24" fill="${way.bg}"/><rect x="0" y="0" width="300" height="600" rx="24" fill="${way.soft}"/><rect x="276" y="0" width="24" height="600" fill="${way.soft}"/>`;
    body += await logo(brand, { variant: "stacked", background: way.soft, x: 30, y: 150, w: 240, h: 300 });
    const n = await text(brand, "heading", name, { x: 340, y: 70, width: 510, size: 58, minSize: 32, maxLines: 2, fill: way.text, lineHeight: 1.05 });
    const d = await text(brand, "body", spec.descriptor, { x: 340, y: 85 + n.height, width: 510, size: 28, minSize: 20, maxLines: 2, fill: way.muted });
    const lines = await contactLines(brand, facts.slice(0, 5).map((x) => ({ value: `${x.label}: ${x.value}` })), { x: 340, y: 0, width: 510, size: 22, fill: way.text, gap: 0.4 });
    body += n.svg + d.svg + `<g transform="translate(0 ${num(540 - lines.height)})">${lines.svg}</g>`;
    if (spec.tagline) body += (await text(brand, "body", spec.tagline, { x: 340, y: 110 + n.height + d.height, width: 510, size: 24, fill: way.highlight })).svg;
    body += `<rect x="2" y="2" width="896" height="596" rx="24" ${cut}/>`;
  }
  return { svg: doc({ widthMm: size[0], heightMm: size[1], title: `${name} label`, body }), widthMm: size[0], heightMm: size[1] };
}

// ── Packaging (tuck-end box) ────────────────────────────────────────────────

export const BOX_SIZES = { small: { W: 700, D: 400, H: 1000 }, medium: { W: 1000, D: 600, H: 1500 }, tall: { W: 700, D: 700, H: 2000 } };

async function boxFaces(spec, brand, details, { W, D, H }) {
  const way = resolveColors(brand.colors, spec.colorway);
  const p = W * 0.1;
  const name = spec.productName || brand.name;
  let front = `<rect width="${W}" height="${H}" fill="${way.bg}"/>`;
  front += await logo(brand, { variant: "horizontal", background: way.bg, x: p, y: p, w: W - p * 2, h: W * 0.22 });
  const n = await text(brand, "heading", name, { x: p, y: H * 0.42, width: W - p * 2, size: W * 0.13, minSize: W * 0.06, maxLines: 3, align: "center", fill: way.text, lineHeight: 1.05 });
  const d = await text(brand, "body", spec.descriptor, { x: p, y: H * 0.42 + n.height + W * 0.04, width: W - p * 2, size: W * 0.055, minSize: W * 0.035, maxLines: 3, align: "center", fill: way.muted });
  front += n.svg + d.svg;
  if (spec.tagline) {
    const t = await text(brand, "body", spec.tagline, { x: p, y: 0, width: W - p * 2, size: W * 0.05, minSize: W * 0.03, maxLines: 2, align: "center", fill: way.highlight });
    front += `<g transform="translate(0 ${num(H - p - t.height)})">${t.svg}</g>`;
  }
  if (spec.artwork === "pattern") front += icon(brand.logo?.icon || "Sparkles", { cx: W / 2, cy: H * 0.32, size: W * 0.18, color: way.highlight, opacity: 0.5 });

  let back = `<rect width="${W}" height="${H}" fill="${way.bg}"/>`;
  back += await logo(brand, { variant: "mark", background: way.bg, x: p, y: p, w: W * 0.2, h: W * 0.2, align: "left" });
  const bt = await text(brand, "body", spec.backText, { x: p, y: p + W * 0.28, width: W - p * 2, size: W * 0.045, minSize: W * 0.03, maxLines: 14, fill: way.text, lineHeight: 1.35 });
  back += bt.svg;
  const facts = spec.details.filter((x) => x.label && x.value).map((x) => ({ value: `${x.label}: ${x.value}` }));
  const f = await contactLines(brand, facts, { x: p, y: p + W * 0.32 + bt.height, width: W - p * 2, size: W * 0.04, fill: way.text, gap: 0.4 });
  back += f.svg;
  const foot = [details.legalName || brand.name, ...addressLines(details).slice(0, 2), websiteLabel(details.website)].filter(Boolean).map((value) => ({ value }));
  const fl = await contactLines(brand, foot, { x: p, y: 0, width: W - p * 2, size: W * 0.035, fill: way.muted, gap: 0.3 });
  back += `<g transform="translate(0 ${num(H - p - fl.height)})">${fl.svg}</g>`;

  let side = `<rect width="${D}" height="${H}" fill="${way.soft}"/>`;
  const sideName = await text(brand, "heading", brand.name, { x: 0, y: 0, width: H * 0.7, size: D * 0.22, minSize: D * 0.1, align: "center", fill: way.text });
  // rotate(-90): the name runs bottom-to-top along the side panel.
  side += `<g transform="translate(${num(D / 2 - sideName.height / 2)} ${num(H * 0.85)}) rotate(-90)">${sideName.svg}</g>`;
  let top = `<rect width="${W}" height="${D}" fill="${way.bg}"/>`;
  top += await logo(brand, { variant: "mark", background: way.bg, x: W * 0.3, y: D * 0.2, w: W * 0.4, h: D * 0.6 });
  return { front, back, side, top, way };
}

async function packaging(spec, brand, details) {
  const dims = BOX_SIZES[spec.template] ?? BOX_SIZES.small;
  const { W, D, H } = dims;
  const faces = await boxFaces(spec, brand, details, dims);
  const G = 150;
  const tuck = 140;
  const margin = 60;
  const T = margin + D + tuck;
  const totalW = 2 * W + 2 * D + G + margin * 2;
  const totalH = H + 2 * (D + tuck) + margin * 2;
  const ox = margin;
  const X = (v) => num(ox + v);
  const pts = [
    [0, T], [0, T - D], [40, T - D - tuck], [W - 40, T - D - tuck], [W, T - D], [W, T],
    [W + 20, T - D * 0.7], [W + D - 20, T - D * 0.7], [W + D, T],
    [2 * W + D, T], [2 * W + D + 20, T - D * 0.7], [2 * W + 2 * D - 20, T - D * 0.7], [2 * W + 2 * D, T],
    [2 * W + 2 * D + G, T + 60], [2 * W + 2 * D + G, T + H - 60], [2 * W + 2 * D, T + H],
    [2 * W + 2 * D - 20, T + H + D * 0.7], [2 * W + D + 20, T + H + D * 0.7], [2 * W + D, T + H],
    [2 * W + D, T + H + D], [2 * W + D - 40, T + H + D + tuck], [W + D + 40, T + H + D + tuck], [W + D, T + H + D], [W + D, T + H],
    [W + D - 20, T + H + D * 0.7], [W + 20, T + H + D * 0.7], [W, T + H], [0, T + H],
  ];
  const panel = (svg, x, y) => `<g transform="translate(${X(x)} ${num(y)})">${svg}</g>`;
  let body = "";
  body += panel(faces.top, 0, T - D);
  body += panel(faces.front, 0, T) + panel(faces.side, W, T) + panel(faces.back, W + D, T) + panel(faces.side, 2 * W + D, T);
  body += `<rect x="${X(W + 20)}" y="${num(T - D * 0.7)}" width="${D - 40}" height="${num(D * 0.7)}" fill="${faces.way.soft}"/><rect x="${X(2 * W + D + 20)}" y="${num(T - D * 0.7)}" width="${D - 40}" height="${num(D * 0.7)}" fill="${faces.way.soft}"/>`;
  body += `<path d="M${pts.map(([x, y]) => `${X(x)} ${num(y)}`).join(" L")} Z" fill="none" stroke="#e5243b" stroke-width="4"/>`;
  const folds = [
    [W, T, W, T + H], [W + D, T, W + D, T + H], [2 * W + D, T, 2 * W + D, T + H], [2 * W + 2 * D, T, 2 * W + 2 * D, T + H],
    [0, T, W, T], [W, T, W + D, T], [2 * W + D, T, 2 * W + 2 * D, T], [0, T - D, W, T - D],
    [W, T + H, W + D, T + H], [W + D, T + H, 2 * W + D, T + H], [2 * W + D, T + H, 2 * W + 2 * D, T + H], [W + D, T + H + D, 2 * W + D, T + H + D],
  ];
  body += folds.map(([x1, y1, x2, y2]) => `<line x1="${X(x1)}" y1="${num(y1)}" x2="${X(x2)}" y2="${num(y2)}" stroke="#2f80ed" stroke-width="3" stroke-dasharray="16 10"/>`).join("");
  const dieline = doc({ widthMm: num(totalW / 10), heightMm: num(totalH / 10), title: `${spec.productName || brand.name} box dieline`, body });

  // Simple 3D mockup: front + side + top faces.
  const s = 560 / Math.max(H, W + D * 0.6);
  const x0 = 500 - ((W + D * 0.55) * s) / 2;
  const y0 = 500 - ((H - D * 0.35) * s) / 2 + D * 0.35 * s * 0.5;
  let mock = `<rect width="1000" height="1000" fill="#f3f1f5"/><ellipse cx="${num(x0 + (W * s) / 2 + D * 0.27 * s)}" cy="${num(y0 + H * s + 18)}" rx="${num(((W + D * 0.55) * s) / 1.8)}" ry="22" fill="#000" opacity="0.08"/>`;
  mock += `<g transform="matrix(${num(s)} 0 0 ${num(s)} ${num(x0)} ${num(y0)})">${faces.front}</g>`;
  mock += `<g transform="matrix(${num(0.55 * s)} ${num(-0.35 * s)} 0 ${num(s)} ${num(x0 + W * s)} ${num(y0)})">${faces.side}<rect width="${D}" height="${H}" fill="#000" opacity="0.12"/></g>`;
  mock += `<g transform="matrix(${num(s)} 0 ${num(0.55 * s)} ${num(-0.35 * s)} ${num(x0)} ${num(y0)})"><g transform="translate(0 ${D}) scale(1 -1)">${faces.top}</g><rect width="${W}" height="${D}" fill="#fff" opacity="0.12"/></g>`;
  const mockup = pixelDoc({ width: 1000, height: 1000, title: `${spec.productName || brand.name} box mockup`, body: mock });
  return { dieline, mockup, widthMm: num(totalW / 10), heightMm: num(totalH / 10) };
}

// ── Entry point ─────────────────────────────────────────────────────────────

/**
 * @returns {Promise<{ views: Array<{ key, label, svg, print, widthMm?, heightMm? }> }>}
 */
export async function renderMaterial({ kind, spec, brand = DEFAULT_BRAND, details = {} }) {
  switch (kind) {
    case "BUSINESS_CARD":
      return { views: [
        { key: "front", label: "Front", svg: await cardFront(spec, brand, details), print: true, widthMm: 91, heightMm: 61 },
        { key: "back", label: "Back", svg: await cardBack(spec, brand), print: true, widthMm: 91, heightMm: 61 },
      ] };
    case "LETTERHEAD":
      return { views: [{ key: "page", label: "A4 page", svg: await letterhead(spec, brand, details), print: true, widthMm: 210, heightMm: 297 }] };
    case "LABEL": {
      const l = await label(spec, brand);
      return { views: [{ key: "label", label: "Label", svg: l.svg, print: true, widthMm: l.widthMm, heightMm: l.heightMm }] };
    }
    case "PACKAGING": {
      const p = await packaging(spec, brand, details);
      return { views: [
        { key: "mockup", label: "Mockup", svg: p.mockup, print: false },
        { key: "dieline", label: "Dieline (print)", svg: p.dieline, print: true, widthMm: p.widthMm, heightMm: p.heightMm },
      ] };
    }
    default: {
      const art = await merchArtworkFile(kind, spec, brand);
      return { views: [
        { key: "mockup", label: "Mockup", svg: await merchMockup(kind, spec, brand), print: false },
        // Transparent print file; previewed on the product colour so light inks stay visible.
        { key: "artwork", label: "Print artwork", svg: art.svg, print: true, widthMm: art.widthMm, heightMm: art.heightMm, previewBackground: art.product },
      ] };
    }
  }
}

export const MATERIAL_SVG_HEADERS = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "private, max-age=30",
};
