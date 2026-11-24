import { z } from "zod";
import { AI_SECTION_TYPES, BACKGROUND_KEYS, PAGE_SLUG_RE, SECTION_TYPE_KEYS, SLUG_RE, SOCIAL_NETWORKS, THEME_KEYS, WEBSITE_TYPE_KEYS, isSafeLink } from "./catalog.js";

const s = (max) => z.string().trim().max(max);
const link = z.string().trim().max(300).refine(isSafeLink, "Use a page (/about), an anchor (#contact), an https:// link, mailto: or tel:.");
const fileId = z.union([z.uuid(), z.literal("")]);

// AI output uses plain strings for links; the service normalizes them (unsafe → empty).
const aiItemSchema = z.object({
  title: s(120).describe("Item title (feature, service, product, project, question, or customer name)."),
  text: s(800).describe("Description, answer or quote."),
  meta: s(80).describe("Short extra: price (only if given), role, date or tag; or empty."),
  icon: s(60).describe("Icon name from the provided list, or empty."),
  link: s(300).describe("Optional link: a page like /contact, #anchor or https URL; or empty."),
});
const itemSchema = aiItemSchema.extend({ link, imageFileId: fileId.default("") });

const textFields = {
  eyebrow: s(80).describe("Small label above the heading, or empty."),
  heading: s(160),
  subheading: s(300).describe("Supporting line, or empty."),
  body: s(2000).describe("Paragraphs separated by blank lines, or empty."),
  ctaLabel: s(40).describe("Main button text, or empty."),
  secondaryLabel: s(40).describe("Second button text, or empty."),
};

/** What the AI writes for one section. */
export const aiSectionSchema = z.object({
  type: z.enum(AI_SECTION_TYPES),
  ...textFields,
  ctaLink: s(300).describe("Main button target: /page, #anchor, https URL, mailto: or tel:, or empty."),
  secondaryLink: s(300).describe("Second button target, or empty."),
  items: z.array(aiItemSchema).max(12),
});

/** A stored, editable section. */
export const sectionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  type: z.enum(SECTION_TYPE_KEYS),
  ...textFields,
  ctaLink: link,
  secondaryLink: link,
  items: z.array(itemSchema).max(24),
  imageFileId: fileId.default(""),
  background: z.enum(BACKGROUND_KEYS).default("default"),
});

export const pageSchema = z.object({
  slug: z.string().regex(PAGE_SLUG_RE, "Use lowercase letters, numbers and dashes."),
  title: s(60).min(1, "Give the page a title."),
  seoTitle: s(70),
  seoDescription: s(170),
  sections: z.array(sectionSchema).max(20),
});

export const siteConfigSchema = z
  .object({
    theme: z.enum(THEME_KEYS),
    tagline: s(160),
    announcement: s(160),
    footerText: s(300),
    contact: z.object({ email: z.union([z.email().max(254), z.literal("")]), phone: s(40), address: s(300), hours: s(300) }),
    social: z.array(z.object({ network: z.enum(Object.keys(SOCIAL_NETWORKS)), url: link })).max(8),
    pages: z.array(pageSchema).min(1).max(10),
  })
  .superRefine((cfg, ctx) => {
    const slugs = cfg.pages.map((p) => p.slug);
    if (slugs[0] !== "home") ctx.addIssue({ code: "custom", path: ["pages", 0, "slug"], message: "The first page must be the home page (slug \"home\")." });
    if (new Set(slugs).size !== slugs.length) ctx.addIssue({ code: "custom", path: ["pages"], message: "Page slugs must be unique." });
    const ids = cfg.pages.flatMap((p) => p.sections.map((x) => x.id));
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["pages"], message: "Section ids must be unique." });
  });

/** AI output for a whole site. */
export const aiSiteSchema = z.object({
  tagline: s(160).describe("Short site tagline."),
  footerText: s(300).describe("One line for the footer, e.g. a short mission statement."),
  pages: z.array(
    z.object({
      slug: s(40).describe("Exactly one of the requested page slugs."),
      title: s(60),
      seoTitle: s(70).describe("Search result title, max 60 chars."),
      seoDescription: s(170).describe("Search result description, max 155 chars."),
      sections: z.array(aiSectionSchema),
    }),
  ),
});

const optionalText = (max) => z.string().trim().max(max).optional().transform((v) => (v === "" ? undefined : v));

export const createWebsiteSchema = z.object({
  businessId: z.uuid(),
  type: z.enum(WEBSITE_TYPE_KEYS),
  theme: z.enum(THEME_KEYS).default("modern"),
  brief: optionalText(2000),
  generate: z.boolean().default(true),
});

export const updateWebsiteSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  slug: z.string().trim().toLowerCase().regex(SLUG_RE, "Use 1–63 lowercase letters, numbers and dashes.").optional(),
  config: siteConfigSchema.optional(),
  baseRevision: z.number().int().min(1).optional(),
});

export const regenerateSectionSchema = z.object({
  pageSlug: z.string().regex(PAGE_SLUG_RE),
  sectionId: z.string().regex(/^[a-z0-9-]{1,40}$/),
  instructions: optionalText(1000),
});

export const domainSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .max(253)
    .regex(/^(?=.{4,253}$)(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/, "Enter a domain like www.example.com (no https://)."),
});

export const submissionSchema = z.object({
  kind: z.enum(["contact", "order"]).default("contact"),
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.email("Enter a valid email.").max(254),
  phone: z.string().trim().max(40).optional().transform((v) => (v === "" ? undefined : v)),
  message: z.string().trim().min(2, "Write a message.").max(5000),
  item: z.string().trim().max(200).optional().transform((v) => (v === "" ? undefined : v)),
  page: z.string().trim().max(200).default("/"),
  website: z.string().max(0, "Spam detected.").optional(),
});
