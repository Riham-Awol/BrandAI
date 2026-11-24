// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import "@/modules/website/mock-fixtures.js";
import { AI_SECTION_TYPES, WEBSITE_TYPES, WEBSITE_TYPE_KEYS, isSafeLink, slugify } from "@/modules/website/catalog.js";
import { buildConfigFromAi, normalizeLink, newSectionId, referencedFileIds, resolveHref, templateConfig } from "@/modules/website/config-utils.js";
import { aiSectionSchema, aiSiteSchema, domainSchema, sectionSchema, siteConfigSchema, submissionSchema } from "@/modules/website/schemas.js";
import { siteFontCss, siteThemeVars } from "@/modules/website/site-theme.js";
import { contrastRatio } from "@/modules/brand/color.js";
import { SiteRenderer } from "@/modules/website/components/site/site-renderer";
import { siteHostFor } from "@/proxy.js";

afterEach(cleanup);

const contact = { email: "", phone: "", address: "", hours: "" };
const siteFixture = (type) => mockFixtureResponder({ module: "website", task: "site", system: `Website type: ${WEBSITE_TYPES[type].label}.` }).data;

describe("links and slugs", () => {
  it("only allows safe link targets", () => {
    for (const ok of ["", "/", "/about", "/contact#form", "#contact", "https://example.com/a?b=1", "mailto:hi@example.com", "tel:+44 113 496 0000"]) expect(isSafeLink(ok)).toBe(true);
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "//evil.com", "/../etc", "vbscript:x", "https://x.com/\"onmouseover", "ftp://x.com"]) expect(isSafeLink(bad)).toBe(false);
  });

  it("normalizes AI links and resolves them for the site base", () => {
    expect(normalizeLink("contact", ["home", "contact"])).toBe("/contact");
    expect(normalizeLink("/home", ["home"])).toBe("/");
    expect(normalizeLink("#Contact Us", [])).toBe("#contact-us");
    expect(normalizeLink("javascript:alert(1)", [])).toBe("");
    expect(resolveHref("/", "/sites/x")).toBe("/sites/x");
    expect(resolveHref("/", "")).toBe("/");
    expect(resolveHref("/about#team", "/sites/x")).toBe("/sites/x/about#team");
    expect(resolveHref("#contact", "/sites/x")).toBe("#contact");
    expect(slugify("Crème Brûlée & Co.")).toBe("creme-brulee-and-co");
  });
});

describe("site config", () => {
  it("fixtures pass the AI schemas", () => {
    for (const type of WEBSITE_TYPE_KEYS) expect(aiSiteSchema.safeParse(siteFixture(type)).success).toBe(true);
    const section = mockFixtureResponder({ module: "website", task: "section", system: 'Rewrite one "features" section' }).data;
    expect(aiSectionSchema.parse(section).type).toBe("features");
    expect(AI_SECTION_TYPES).not.toContain("testimonials");
  });

  it("builds a valid config for every website type with the planned pages and sections", () => {
    for (const type of WEBSITE_TYPE_KEYS) {
      const config = buildConfigFromAi(siteFixture(type), { type, theme: "modern", contact });
      expect(siteConfigSchema.safeParse(config).success).toBe(true);
      expect(config.pages.map((p) => p.slug)).toEqual(WEBSITE_TYPES[type].pages.map((p) => p.slug));
      for (const [i, planned] of WEBSITE_TYPES[type].pages.entries()) {
        for (const t of planned.sections) expect(config.pages[i].sections.map((s) => s.type)).toContain(t);
      }
    }
  });

  it("drops AI testimonials and unknown pages, and uses real products", () => {
    const ai = siteFixture("STORE");
    ai.pages[0].sections.push({ ...ai.pages[0].sections[0], type: "testimonials" }); // schema would refuse it; code must too
    ai.pages.push({ slug: "admin", title: "Admin", seoTitle: "", seoDescription: "", sections: [] });
    const config = buildConfigFromAi(ai, { type: "STORE", theme: "bold", contact, products: [{ name: "Rye", description: "Dense", priceRange: "£5" }] });
    expect(config.pages.flatMap((p) => p.sections.map((s) => s.type))).not.toContain("testimonials");
    expect(config.pages.map((p) => p.slug)).not.toContain("admin");
    expect(config.pages[0].sections.find((s) => s.type === "products").items).toEqual([expect.objectContaining({ title: "Rye", meta: "£5" })]);
  });

  it("starter templates are valid and ids stay unique", () => {
    for (const type of WEBSITE_TYPE_KEYS) {
      const config = templateConfig({ type, theme: "classic", businessName: "Acme", contact });
      expect(siteConfigSchema.safeParse(config).success).toBe(true);
      expect(newSectionId(config, "hero")).toBe("hero-2");
    }
  });

  it("rejects duplicate pages, a missing home page and unsafe links", () => {
    const config = templateConfig({ type: "BUSINESS", theme: "modern", businessName: "Acme", contact });
    expect(siteConfigSchema.safeParse({ ...config, pages: [config.pages[1], config.pages[0]] }).success).toBe(false);
    expect(siteConfigSchema.safeParse({ ...config, pages: [...config.pages, config.pages[1]] }).success).toBe(false);
    const bad = structuredClone(config);
    bad.pages[0].sections[0].items = [{ title: "x", text: "", meta: "", icon: "", link: "javascript:x", imageFileId: "" }];
    expect(siteConfigSchema.safeParse(bad).success).toBe(false);
    expect(sectionSchema.safeParse({ ...config.pages[0].sections[0], type: "script" }).success).toBe(false);
  });

  it("collects referenced images", () => {
    const config = templateConfig({ type: "LANDING", theme: "modern", businessName: "Acme", contact });
    const a = "6f1c1b5e-4b7a-4c55-9a1e-0d6c6b2f8a11";
    const b = "7f1c1b5e-4b7a-4c55-9a1e-0d6c6b2f8a11";
    config.pages[0].sections[0].imageFileId = a;
    config.pages[0].sections[1].items[0].imageFileId = b;
    expect([...referencedFileIds(config)].sort()).toEqual([a, b]);
  });
});

describe("forms and domains", () => {
  it("validates contact submissions and catches the honeypot", () => {
    expect(submissionSchema.parse({ name: "Ann", email: "ann@example.com", message: "Hi there", phone: "" }).phone).toBeUndefined();
    expect(submissionSchema.safeParse({ name: "Ann", email: "ann@example.com", message: "Hi", website: "x" }).success).toBe(false);
    expect(submissionSchema.safeParse({ name: "", email: "bad", message: "" }).success).toBe(false);
  });

  it("accepts only plain domain names", () => {
    expect(domainSchema.parse({ domain: " WWW.Example.co.uk " }).domain).toBe("www.example.co.uk");
    for (const bad of ["https://example.com", "example", "exa mple.com", "-x.com", "127.0.0.1"]) expect(domainSchema.safeParse({ domain: bad }).success).toBe(false);
  });

  it("rewrites only foreign hosts in the proxy", () => {
    const req = (host, fwd) => ({ headers: new Headers({ host, ...(fwd ? { "x-forwarded-host": fwd } : {}) }) });
    expect(siteHostFor(req("localhost:3000"))).toBeNull();
    expect(siteHostFor(req("www.kirkgate.example"))).toBe("www.kirkgate.example");
    expect(siteHostFor(req("localhost", "Shop.Example.com:443"))).toBe("shop.example.com");
    expect(siteHostFor(req("127.0.0.1"))).toBeNull();
  });
});

describe("site theme", () => {
  it("keeps every text/background pair readable, even with a poor palette", () => {
    for (const colors of [{}, { primary: "#ffff00", secondary: "#ffffaa", accent: "#00ffff", dark: "#777777", light: "#888888", background: "#999999" }, { background: "#101010", dark: "#f5f5f5", light: "#ffffff", primary: "#ff3366" }]) {
      const v = siteThemeVars(colors);
      for (const [fg, bg] of [["--s-fg", "--s-bg"], ["--s-muted-fg", "--s-bg"], ["--s-soft-fg", "--s-soft"], ["--s-btn-fg", "--s-btn"], ["--s-accent-fg", "--s-accent-bg"], ["--s-accent-btn-fg", "--s-accent-btn"], ["--s-inverse-fg", "--s-inverse-bg"], ["--s-inverse-muted", "--s-inverse-bg"]]) {
        expect(contrastRatio(v[fg], v[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("only emits @font-face rules for bundled fonts", () => {
    expect(siteFontCss({ heading: { fontKey: "fraunces", weight: "700" }, body: { fontKey: "manrope", weight: "500" } })).toContain("url(/api/v1/fonts/fraunces/700)");
    const css = siteFontCss({ heading: { fontKey: "x}</style><script>", weight: "700" }, body: { fontKey: "manrope", weight: "999" } });
    expect(css).not.toMatch(/script|style|999|site-heading/);
  });
});

describe("site renderer", () => {
  const brand = { name: "Kirkgate Bakery", colors: {}, heading: { fontKey: "fraunces", weight: "700" }, body: { fontKey: "manrope", weight: "500" }, logo: null };
  const props = { brand, mode: "public", basePath: "/sites/kirkgate", media: (id) => `/m/${id}`, formAction: "/api/v1/sites/kirkgate/contact", year: 2026 };

  it("renders AI content as text, never as markup", () => {
    const config = buildConfigFromAi(siteFixture("BUSINESS"), { type: "BUSINESS", theme: "modern", contact: { ...contact, email: "hi@example.com" } });
    config.pages[0].sections[0].heading = '<img src=x onerror="alert(1)">';
    const { container } = render(<SiteRenderer {...props} config={config} pageSlug="home" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe('<img src=x onerror="alert(1)">');
    expect(container.querySelector("img[onerror]")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByRole("link", { name: "Visit us" })).toHaveAttribute("href", "/sites/kirkgate/contact");
    expect(within(screen.getByRole("navigation", { name: "Main" })).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/sites/kirkgate", "/sites/kirkgate/about", "/sites/kirkgate/services", "/sites/kirkgate/contact"]);
    expect(screen.getByText("© 2026 Kirkgate Bakery")).toBeInTheDocument();
  });

  it("product order buttons open the contact form with the item, which posts to the site's form endpoint", () => {
    const config = buildConfigFromAi(siteFixture("STORE"), { type: "STORE", theme: "bold", contact });
    render(<SiteRenderer {...props} config={config} pageSlug="home" />);
    const order = screen.getAllByRole("link", { name: "Order / enquire" })[0];
    expect(order.getAttribute("href")).toBe("/sites/kirkgate/contact?item=Country%20loaf#contact");
    cleanup();
    const { container } = render(<SiteRenderer {...props} config={config} pageSlug="contact" orderItem="Country loaf" />);
    const form = container.querySelector("form");
    expect(form).toHaveAttribute("action", "/api/v1/sites/kirkgate/contact");
    expect(form.querySelector('input[name="item"]')).toHaveValue("Country loaf");
    expect(form.querySelector('input[name="kind"]')).toHaveValue("order");
    expect(form.querySelector('input[name="website"]')).not.toBeNull(); // honeypot
  });

  it("hides empty galleries and testimonials on the live site but explains them in the preview", () => {
    const config = templateConfig({ type: "PORTFOLIO", theme: "classic", businessName: "Studio", contact });
    config.pages[0].sections.push({ ...config.pages[0].sections[0], id: "testimonials", type: "testimonials", heading: "Kind words", items: [] });
    render(<SiteRenderer {...props} config={config} pageSlug="home" />);
    expect(screen.queryByText("Kind words")).toBeNull();
    cleanup();
    render(<SiteRenderer {...props} mode="preview" config={config} pageSlug="home" />);
    expect(screen.getByText(/never writes reviews/)).toBeInTheDocument();
  });
});
