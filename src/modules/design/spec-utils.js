import { ICON_NAMES } from "@/modules/brand/catalog/icons.js";
import { TEMPLATE_KEYS } from "./catalog.js";

const ICON_BY_LOWER = new Map(ICON_NAMES.map((n) => [n.toLowerCase().replace(/[^a-z0-9]/g, ""), n]));

/** Cleans AI output: valid icon name or none, trimmed text, sensible list sizes. Pure. */
export function normalizeSpec(spec) {
  const icon = spec.icon ? ICON_BY_LOWER.get(spec.icon.toLowerCase().replace(/[^a-z0-9]/g, "")) ?? "" : "";
  const t = (v) => (v ?? "").trim();
  return {
    ...spec,
    name: t(spec.name) || "Design",
    eyebrow: t(spec.eyebrow),
    headline: t(spec.headline) || t(spec.name) || "Your headline",
    subheadline: t(spec.subheadline),
    body: t(spec.body),
    badge: t(spec.badge),
    cta: t(spec.cta),
    footer: t(spec.footer),
    bullets: spec.bullets.map(t).filter(Boolean).slice(0, 4),
    details: spec.details.map((d) => ({ label: t(d.label), value: t(d.value) })).filter((d) => d.label && d.value).slice(0, 4),
    icon,
  };
}

/** When the user supplied a photo, make sure at least one option shows it. Pure. */
export function ensurePhotoLayout(options, hasImage) {
  if (!hasImage || options.some((o) => o.template === "split_image")) return options;
  return options.map((o, i) => (i === 0 ? { ...o, template: "split_image" } : o));
}

/** Ensures the three options use distinct templates (AI sometimes repeats). Pure. */
export function diversifyTemplates(options) {
  const used = new Set();
  return options.map((o) => {
    if (!used.has(o.template)) {
      used.add(o.template);
      return o;
    }
    const template = TEMPLATE_KEYS.find((k) => !used.has(k));
    used.add(template);
    return { ...o, template };
  });
}

