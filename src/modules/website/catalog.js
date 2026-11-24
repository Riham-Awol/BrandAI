/**
 * Website types, themes and the whitelisted section types (client-safe).
 * A website is only ever rendered from these controlled components — AI writes
 * structured content, never code or markup.
 */
export const WEBSITE_TYPES = {
  BUSINESS: {
    label: "Business website",
    description: "A multi-page site: home, about, services and contact.",
    pages: [
      { slug: "home", title: "Home", sections: ["hero", "features", "services", "cta"] },
      { slug: "about", title: "About", sections: ["about", "features", "cta"] },
      { slug: "services", title: "Services", sections: ["services", "faq", "cta"] },
      { slug: "contact", title: "Contact", sections: ["contact"] },
    ],
  },
  LANDING: {
    label: "Landing page",
    description: "One focused page for a launch, offer or campaign.",
    pages: [{ slug: "home", title: "Home", sections: ["hero", "features", "about", "faq", "cta", "contact"] }],
  },
  PORTFOLIO: {
    label: "Portfolio",
    description: "Show your work: projects, about and contact.",
    pages: [
      { slug: "home", title: "Home", sections: ["hero", "portfolio", "cta"] },
      { slug: "work", title: "Work", sections: ["portfolio", "gallery"] },
      { slug: "about", title: "About", sections: ["about", "services"] },
      { slug: "contact", title: "Contact", sections: ["contact"] },
    ],
  },
  STORE: {
    label: "Online store",
    description: "A product catalogue with order enquiries (no card payments yet).",
    pages: [
      { slug: "home", title: "Home", sections: ["hero", "products", "features", "cta"] },
      { slug: "shop", title: "Shop", sections: ["products", "faq"] },
      { slug: "about", title: "About", sections: ["about", "features"] },
      { slug: "contact", title: "Contact", sections: ["contact"] },
    ],
  },
};
export const WEBSITE_TYPE_KEYS = Object.keys(WEBSITE_TYPES);

export const THEMES = {
  modern: { label: "Modern", description: "Clean, rounded, airy." },
  classic: { label: "Classic", description: "Elegant serif headings, fine lines." },
  bold: { label: "Bold", description: "Big type and strong colour blocks." },
};
export const THEME_KEYS = Object.keys(THEMES);

export const SECTION_TYPES = {
  hero: { label: "Hero", description: "Big headline with call to action" },
  features: { label: "Features", description: "Key benefits in a grid" },
  about: { label: "About", description: "Your story, with an optional photo" },
  services: { label: "Services", description: "What you offer, with optional prices" },
  products: { label: "Products", description: "Product cards with order enquiry" },
  portfolio: { label: "Portfolio", description: "Projects or case studies" },
  gallery: { label: "Gallery", description: "Photos from your brand assets" },
  testimonials: { label: "Testimonials", description: "Real customer quotes (you add them; AI never invents reviews)" },
  faq: { label: "FAQ", description: "Questions and answers" },
  cta: { label: "Call to action", description: "A short closing push" },
  contact: { label: "Contact", description: "Contact form and your details" },
  text: { label: "Text", description: "A plain block of text" },
};
export const SECTION_TYPE_KEYS = Object.keys(SECTION_TYPES);
/** Section types the AI may write (testimonials must come from real customers). */
export const AI_SECTION_TYPES = SECTION_TYPE_KEYS.filter((t) => t !== "testimonials");

export const BACKGROUNDS = { default: "Page", muted: "Soft", accent: "Brand colour", inverse: "Dark" };
export const BACKGROUND_KEYS = Object.keys(BACKGROUNDS);

export const SOCIAL_NETWORKS = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", linkedin: "LinkedIn", x: "X", youtube: "YouTube", whatsapp: "WhatsApp" };

/** Slugs that cannot be used as page or site slugs. */
export const RESERVED_SLUGS = new Set(["api", "admin", "app", "www", "sites", "media", "static", "assets", "login", "_next"]);

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
export const PAGE_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export function slugify(value, max = 50) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

/**
 * Allowed link targets: internal pages ("/about"), anchors ("#contact"), http(s),
 * mailto: and tel:. Everything else (javascript:, data:, …) is rejected.
 */
export function isSafeLink(link) {
  if (!link) return true;
  if (/^#[a-z0-9-]{1,40}$/.test(link)) return true;
  if (/^\/(?:[a-z0-9-]{1,40}(?:#[a-z0-9-]{1,40})?)?$/.test(link)) return true;
  if (/^mailto:[^\s<>"']{3,200}$/i.test(link)) return true;
  if (/^tel:\+?[0-9 ()-]{3,30}$/i.test(link)) return true;
  try {
    const u = new URL(link);
    return (u.protocol === "https:" || u.protocol === "http:") && Boolean(u.hostname) && !/[\s<>"']/.test(link);
  } catch {
    return false;
  }
}
