import { ARTWORK_KEYS, COLORWAY_KEYS, MATERIAL_KINDS, PLACEMENT_KEYS, PRODUCT_COLOR_KEYS, TEMPLATE_KEYS } from "./catalog.js";

const t = (v, max) => String(v ?? "").trim().slice(0, max);
const pick = (value, allowed, fallback) => {
  const v = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return allowed.includes(v) ? v : fallback;
};

/** A complete spec with sensible defaults for a kind. Pure. */
export function blankSpec(kind, over = {}) {
  const k = MATERIAL_KINDS[kind];
  return {
    name: k.label,
    template: k.templates?.[0] ?? "classic",
    colorway: "primary",
    productColor: "white",
    artwork: "logo",
    placement: k.placements?.[0] ?? "center",
    slogan: "",
    tagline: "",
    person: { name: "", title: "", phone: "", email: "" },
    showDetails: true,
    showRegistration: true,
    footerNote: "",
    productName: "",
    descriptor: "",
    details: [],
    backText: "",
    ...over,
  };
}

/**
 * Coerces any (AI or user) partial spec into a valid one for the kind:
 * unknown template/placement/colour/artwork keys fall back to the kind's defaults. Pure.
 */
export function normalizeMaterialSpec(kind, raw, base = blankSpec(kind)) {
  const k = MATERIAL_KINDS[kind];
  const templates = k.templates ?? [base.template];
  const placements = k.placements ?? [base.placement];
  return {
    ...base,
    name: t(raw.name, 80) || base.name,
    template: pick(raw.template, templates.filter((x) => TEMPLATE_KEYS.includes(x)), templates[0]),
    colorway: pick(raw.colorway, COLORWAY_KEYS, base.colorway),
    productColor: pick(raw.productColor, PRODUCT_COLOR_KEYS, base.productColor),
    artwork: pick(raw.artwork, ARTWORK_KEYS, base.artwork),
    placement: pick(raw.placement, placements.filter((x) => PLACEMENT_KEYS.includes(x)), placements[0]),
    slogan: t(raw.slogan ?? base.slogan, 60),
    tagline: t(raw.tagline ?? base.tagline, 100),
    person: { ...base.person, ...(raw.person ?? {}) },
    showDetails: raw.showDetails ?? base.showDetails,
    showRegistration: raw.showRegistration ?? base.showRegistration,
    footerNote: t(raw.footerNote ?? base.footerNote, 160),
    productName: t(raw.productName ?? base.productName, 60),
    descriptor: t(raw.descriptor ?? base.descriptor, 120),
    details: (raw.details ?? base.details).map((d) => ({ label: t(d.label, 30), value: t(d.value, 120) })).filter((d) => d.label && d.value).slice(0, 6),
    backText: t(raw.backText ?? base.backText, 600),
  };
}

/** Three template-based options for stationery (no AI needed). Pure. */
export function templateOptions(kind, base) {
  const ways = ["primary", "dark", "accent"];
  return MATERIAL_KINDS[kind].templates.map((template, i) => normalizeMaterialSpec(kind, { ...base, template, colorway: ways[i % 3], name: `${MATERIAL_KINDS[kind].label} — ${template.replace("_", " ")}` }, base));
}
