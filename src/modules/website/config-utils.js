import { ICON_NAMES } from "@/modules/brand/catalog/icons.js";
import { AI_SECTION_TYPES, PAGE_SLUG_RE, SECTION_TYPES, WEBSITE_TYPES, isSafeLink, slugify } from "./catalog.js";

const ICON_BY_LOWER = new Map(ICON_NAMES.map((n) => [n.toLowerCase().replace(/[^a-z0-9]/g, ""), n]));
const t = (v, max) => String(v ?? "").trim().slice(0, max);

export function normalizeIcon(icon) {
  if (!icon) return "";
  return ICON_BY_LOWER.get(String(icon).toLowerCase().replace(/[^a-z0-9]/g, "")) ?? "";
}

/** Makes AI/user links safe: bare page slugs become "/slug", unknown schemes are dropped. Pure. */
export function normalizeLink(link, pageSlugs = []) {
  let l = t(link, 300);
  if (!l) return "";
  if (pageSlugs.includes(l.replace(/^\//, "").toLowerCase())) l = `/${l.replace(/^\//, "").toLowerCase()}`;
  if (l === "/home") l = "/";
  if (/^#/.test(l)) l = `#${slugify(l.slice(1), 40)}`;
  return isSafeLink(l) ? l : "";
}

/** Next free section id for a type, e.g. "features-2". */
export function newSectionId(config, type) {
  const used = new Set((config?.pages ?? []).flatMap((p) => p.sections.map((s) => s.id)));
  for (let n = 1; ; n++) {
    const id = n === 1 ? type : `${type}-${n}`;
    if (!used.has(id)) return id;
  }
}

// Alternating backgrounds keep neighbouring sections visually separate.
const DEFAULT_BACKGROUND = { features: "muted", faq: "muted", testimonials: "muted", cta: "accent" };

/** An empty section of a type (used by "Add section" and templates). */
export function blankSection(id, type, over = {}) {
  return {
    id, type, eyebrow: "", heading: "", subheading: "", body: "", ctaLabel: "", ctaLink: "", secondaryLabel: "", secondaryLink: "",
    items: [], imageFileId: "", background: DEFAULT_BACKGROUND[type] ?? "default", ...over,
  };
}

/** Converts one AI section into a stored section. Pure. */
export function sectionFromAi(ai, id, pageSlugs) {
  const items = (ai.items ?? []).slice(0, 12).map((i) => ({
    title: t(i.title, 120), text: t(i.text, 800), meta: t(i.meta, 80), icon: normalizeIcon(i.icon), link: normalizeLink(i.link, pageSlugs), imageFileId: "",
  })).filter((i) => i.title || i.text);
  return blankSection(id, ai.type, {
    eyebrow: t(ai.eyebrow, 80), heading: t(ai.heading, 160), subheading: t(ai.subheading, 300), body: t(ai.body, 2000),
    ctaLabel: t(ai.ctaLabel, 40), ctaLink: normalizeLink(ai.ctaLink, pageSlugs), secondaryLabel: t(ai.secondaryLabel, 40), secondaryLink: normalizeLink(ai.secondaryLink, pageSlugs),
    items,
  });
}

/** Real products/services from the business profile → cards (prices only when the owner entered them). */
export function catalogItems(rows) {
  return rows.slice(0, 24).map((r) => ({ title: t(r.name, 120), text: t(r.description, 800), meta: t(r.priceRange, 80), icon: "", link: "", imageFileId: "" }));
}

/**
 * Builds a site config from AI output, constrained to the website type's pages
 * and whitelisted section types. Products/services come from the real profile
 * when it has them. Pure.
 */
export function buildConfigFromAi(ai, { type, theme, contact, products = [], services = [] }) {
  const plan = WEBSITE_TYPES[type].pages;
  const slugs = plan.map((p) => p.slug);
  const config = { theme, tagline: t(ai.tagline, 160), announcement: "", footerText: t(ai.footerText, 300), contact, social: [], pages: [] };
  for (const planned of plan) {
    const aiPage = ai.pages.find((p) => slugify(p.slug) === planned.slug) ?? (planned.slug === "home" ? ai.pages[0] : null);
    const page = {
      slug: planned.slug,
      // Navigation uses the standard page name; the AI's wording goes into the SEO title.
      title: planned.title,
      seoTitle: t(aiPage?.seoTitle, 70) || t(aiPage?.title, 70),
      seoDescription: t(aiPage?.seoDescription, 170),
      sections: [],
    };
    config.pages.push(page);
    for (const s of (aiPage?.sections ?? []).filter((x) => AI_SECTION_TYPES.includes(x.type)).slice(0, 12)) {
      page.sections.push(sectionFromAi(s, newSectionId(config, s.type), slugs));
    }
    // Every planned section type is present (AI sometimes skips one).
    for (const typeKey of planned.sections) {
      if (!page.sections.some((s) => s.type === typeKey)) page.sections.push(blankSection(newSectionId(config, typeKey), typeKey, { heading: SECTION_TYPES[typeKey].label }));
    }
  }
  fillCatalog(config, { products, services });
  return config;
}

function fillCatalog(config, { products, services }) {
  for (const page of config.pages) {
    for (const section of page.sections) {
      if (section.type === "products" && products.length) section.items = catalogItems(products);
      if (section.type === "services" && services.length) section.items = catalogItems(services);
    }
  }
}

/** Starter template (no AI): placeholder text the owner replaces. Pure. */
export function templateConfig({ type, theme, businessName, contact, products = [], services = [] }) {
  const config = { theme, tagline: "", announcement: "", footerText: "", contact, social: [], pages: [] };
  const plan = WEBSITE_TYPES[type].pages;
  for (const planned of plan) {
    const page = { slug: planned.slug, title: planned.title, seoTitle: "", seoDescription: "", sections: [] };
    config.pages.push(page);
    for (const typeKey of planned.sections) {
      const id = newSectionId(config, typeKey);
      const starter = STARTER[typeKey]?.(businessName) ?? { heading: SECTION_TYPES[typeKey].label };
      page.sections.push(blankSection(id, typeKey, starter));
    }
  }
  fillCatalog(config, { products, services });
  return config;
}

const item = (title, text, extra = {}) => ({ title, text, meta: "", icon: "", link: "", imageFileId: "", ...extra });
const STARTER = {
  hero: (name) => ({ heading: `Welcome to ${name}`, subheading: "Say in one sentence what you do and who it's for.", ctaLabel: "Get in touch", ctaLink: "#contact" }),
  features: () => ({ heading: "Why choose us", items: [item("First reason", "Describe a benefit.", { icon: "Star" }), item("Second reason", "Describe a benefit.", { icon: "Heart" }), item("Third reason", "Describe a benefit.", { icon: "ShieldCheck" })] }),
  services: () => ({ heading: "What we offer", items: [item("Service one", "Describe the service."), item("Service two", "Describe the service.")] }),
  products: () => ({ heading: "Our products", items: [item("Product one", "Describe the product."), item("Product two", "Describe the product.")] }),
  portfolio: () => ({ heading: "Selected work", items: [item("Project one", "What you did and the result."), item("Project two", "What you did and the result.")] }),
  about: (name) => ({ heading: `About ${name}`, body: "Tell your story: why you started, what you believe in and who you serve." }),
  faq: () => ({ heading: "Questions", items: [item("Add a common question?", "And its answer.")] }),
  cta: () => ({ heading: "Ready to get started?", ctaLabel: "Contact us", ctaLink: "#contact" }),
  contact: () => ({ heading: "Contact us", subheading: "Send us a message and we'll get back to you." }),
  gallery: () => ({ heading: "Gallery" }),
  testimonials: () => ({ heading: "What customers say" }),
  text: () => ({ heading: "", body: "" }),
};

export function findPage(config, slug) {
  return config.pages.find((p) => p.slug === slug) ?? null;
}

/** All stored-file ids a config references (for media access checks). Pure. */
export function referencedFileIds(config) {
  const ids = new Set();
  for (const p of config?.pages ?? []) for (const s of p.sections) {
    if (s.imageFileId) ids.add(s.imageFileId);
    for (const i of s.items ?? []) if (i.imageFileId) ids.add(i.imageFileId);
  }
  return ids;
}

/** Turns a stored link into an href for the given site base path ("" on a custom domain). Pure. */
export function resolveHref(link, basePath) {
  if (!link) return null;
  if (link.startsWith("/")) {
    const [path, hash] = link.split("#");
    const page = path === "/" || path === "/home" ? "" : path;
    return `${basePath}${page}${hash ? `#${hash}` : ""}` || "/";
  }
  return link;
}

export function isValidPageSlug(slug) {
  return PAGE_SLUG_RE.test(slug);
}
