import { describe, expect, it } from "vitest";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import "@/modules/brand/mock-fixtures.js";
import { DESIGN_OPTIONS_FIXTURE } from "@/modules/design/mock-fixtures.js";
import { COLOR_SCHEME_KEYS, DESIGN_FORMATS, DESIGN_KINDS, FORMAT_KEYS, POST_FORMAT_TO_DESIGN, TEMPLATE_KEYS, isPrint } from "@/modules/design/catalog.js";
import { designBriefSchema, designOptionsSchema, designSpecSchema, saveDesignSchema } from "@/modules/design/schemas.js";
import { diversifyTemplates, ensurePhotoLayout, normalizeSpec } from "@/modules/design/spec-utils.js";
import { DEFAULT_BRAND, DESIGN_SVG_HEADERS, renderDesignSvg, resolveColors } from "@/server/design/renderer.js";
import { contrastRatio } from "@/modules/brand/color.js";
import { loadFont } from "@/server/brand/fonts.js";
import { fitText, measure, normalizeTypography, wrapText } from "@/server/brand/text.js";

const spec = DESIGN_OPTIONS_FIXTURE.options[0];
const concept = mockFixtureResponder({ module: "brand", task: "logo_concepts" }).data.concepts[0];
const brandWithLogo = { ...DEFAULT_BRAND, name: "Kirkgate Bakery", logo: concept };

describe("design catalog", () => {
  it("only offers known formats for each kind and maps every post format", () => {
    for (const k of Object.values(DESIGN_KINDS)) for (const f of k.formats) expect(FORMAT_KEYS).toContain(f);
    for (const f of Object.values(POST_FORMAT_TO_DESIGN)) expect(FORMAT_KEYS).toContain(f);
    expect(isPrint("a4_portrait")).toBe(true);
    expect(isPrint("square")).toBe(false);
  });
});

describe("design schemas and fixtures", () => {
  it("mock fixture passes the AI output schema with three distinct templates", () => {
    const parsed = designOptionsSchema.parse(DESIGN_OPTIONS_FIXTURE);
    expect(parsed.options).toHaveLength(3);
    expect(new Set(parsed.options.map((o) => o.template)).size).toBe(3);
  });

  it("validates briefs and caps text lengths", () => {
    const businessId = "6f1c1b5e-4b7a-4c55-9a1e-0d6c6b2f8a11";
    expect(designBriefSchema.safeParse({ businessId, kind: "POSTER", format: "a4_portrait", brief: "hi" }).success).toBe(false);
    const ok = designBriefSchema.parse({ businessId, kind: "POSTER", format: "a4_portrait", brief: "Poster for our rye launch", cta: "", imageFileId: "" });
    expect(ok.cta).toBeUndefined();
    expect(ok.imageFileId).toBeUndefined();
    expect(designSpecSchema.safeParse({ ...spec, headline: "x".repeat(161) }).success).toBe(false);
    expect(saveDesignSchema.safeParse({ businessId, kind: "AD", format: "bogus", spec }).success).toBe(false);
  });
});

describe("spec normalization", () => {
  it("fixes icon names, trims text and drops empty details", () => {
    const n = normalizeSpec({ ...spec, icon: "shopping-bag", headline: "  Hi  ", bullets: [" a ", "", "b", "c", "d", "e"], details: [{ label: "Date", value: "" }, { label: "Where", value: "Leeds" }] });
    expect(n.icon).toBe("ShoppingBag");
    expect(n.headline).toBe("Hi");
    expect(n.bullets).toEqual(["a", "b", "c", "d"]);
    expect(n.details).toEqual([{ label: "Where", value: "Leeds" }]);
    expect(normalizeSpec({ ...spec, icon: "<script>" }).icon).toBe("");
  });

  it("puts a provided photo into at least one option", () => {
    const opts = DESIGN_OPTIONS_FIXTURE.options;
    expect(ensurePhotoLayout(opts, false)).toBe(opts);
    expect(ensurePhotoLayout(opts, true)[0].template).toBe("split_image");
    const withSplit = [{ ...opts[0], template: "split_image" }, opts[1]];
    expect(ensurePhotoLayout(withSplit, true)).toBe(withSplit);
  });

  it("gives repeated templates distinct ones", () => {
    const out = diversifyTemplates([spec, spec, spec].map((s) => ({ ...s, template: "bold_headline" })));
    expect(new Set(out.map((o) => o.template)).size).toBe(3);
  });
});

describe("text fitting", () => {
  it("shrinks rather than breaking words, and wraps within width", async () => {
    const font = await loadFont("fraunces", "700");
    const fitted = fitText(font, "Sourdough baked before sunrise", { maxWidth: 300, maxLines: 4, size: 120, minSize: 20 });
    for (const line of fitted.lines) {
      expect(measure(font, line, fitted.size)).toBeLessThanOrEqual(300.5);
      for (const word of line.split(" ")) expect("Sourdough baked before sunrise".split(" ")).toContain(word);
    }
    expect(wrapText(font, "a\nb", 20, 500)).toEqual(["a", "b"]);
  });

  it("maps typographic characters the fonts lack", async () => {
    expect(normalizeTypography("9am\u201112pm\u00a0Hands\u2010on\u200b")).toBe("9am-12pm Hands-on");
    const font = await loadFont("inter", "500");
    const { hasAllGlyphs } = await import("@/server/brand/text.js");
    expect(hasAllGlyphs(font, normalizeTypography("Hands\u2011on 9am\u201212pm"))).toBe(true);
  });

  it("truncates with an ellipsis when even the minimum size overflows", async () => {
    const font = await loadFont("inter", "500");
    const fitted = fitText(font, "word ".repeat(80), { maxWidth: 100, maxLines: 2, size: 20, minSize: 18 });
    expect(fitted.truncated).toBe(true);
    expect(fitted.lines).toHaveLength(2);
    expect(fitted.lines[1].endsWith("…")).toBe(true);
  });
});

describe("colour schemes", () => {
  it("keeps body text readable (WCAG AA) on every scheme, even with poor brand colours", () => {
    const palettes = [DEFAULT_BRAND.colors, { primary: "#ffff00", secondary: "#ffffaa", accent: "#00ffff", dark: "#777777", light: "#888888", background: "#999999" }];
    for (const colors of palettes) {
      for (const scheme of COLOR_SCHEME_KEYS) {
        const c = resolveColors(colors, scheme);
        expect(contrastRatio(c.text, c.bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(c.muted, c.bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(c.ctaFg, c.ctaBg)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(c.badgeFg, c.badgeBg)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("design renderer", () => {
  it("renders every template in every format without invalid numbers", async () => {
    for (const format of FORMAT_KEYS) {
      for (const template of TEMPLATE_KEYS) {
        const { svg, width, height } = await renderDesignSvg({ spec: { ...spec, template }, format, brand: brandWithLogo });
        expect(svg.startsWith("<svg")).toBe(true);
        expect(svg).toContain(`viewBox="0 0 ${DESIGN_FORMATS[format].width} ${DESIGN_FORMATS[format].height}"`);
        expect(svg).not.toMatch(/NaN|undefined|Infinity/);
        expect([width, height]).toEqual([DESIGN_FORMATS[format].width, DESIGN_FORMATS[format].height]);
      }
    }
  }, 60_000);

  it("never emits user text as markup (text is outlined; the title is escaped)", async () => {
    const evil = { ...spec, headline: `<script>alert(1)</script>"&`, body: "<img src=x onerror=alert(1)>", footer: "javascript:alert(1)", icon: "x\" onload=\"alert(1)" };
    const { svg } = await renderDesignSvg({ spec: evil, format: "square", brand: brandWithLogo });
    expect(svg).not.toMatch(/<script|onerror|onload|javascript:|<img/i);
    expect(svg).toContain("<title>&lt;script&gt;alert(1)&lt;/script&gt;&quot;&amp;</title>");
  });

  it("embeds a provided image only as given and shows a placeholder otherwise", async () => {
    const image = "data:image/png;base64,iVBORw0KGgo=";
    const withImage = await renderDesignSvg({ spec: { ...spec, template: "split_image" }, format: "square", brand: DEFAULT_BRAND, image });
    expect(withImage.svg).toContain(`href="${image}"`);
    const without = await renderDesignSvg({ spec: { ...spec, template: "split_image" }, format: "square", brand: DEFAULT_BRAND });
    expect(without.svg).not.toContain("<image");
    expect(DESIGN_SVG_HEADERS["Content-Security-Policy"]).toContain("img-src data:");
  });

  it("uses the business name as a text logo when no logo is approved", async () => {
    const withLogo = await renderDesignSvg({ spec, format: "square", brand: brandWithLogo });
    const withoutLogo = await renderDesignSvg({ spec, format: "square", brand: { ...DEFAULT_BRAND, name: "Kirkgate Bakery" } });
    expect(withLogo.svg).toContain("Kirkgate Bakery logo</title>");
    expect(withoutLogo.svg).not.toContain("logo</title>");
    const hidden = await renderDesignSvg({ spec: { ...spec, showLogo: false }, format: "square", brand: brandWithLogo });
    expect(hidden.svg).not.toContain("logo</title>");
  });

  it("hides optional content that cannot fit and says so", async () => {
    const long = { ...spec, body: "Fresh bread every day. ".repeat(20), bullets: ["One point", "Two points", "Three points", "Four points"], details: [{ label: "Date", value: "Saturday" }] };
    const { warnings } = await renderDesignSvg({ spec: long, format: "medium_rectangle", brand: DEFAULT_BRAND });
    expect(warnings.join(" ")).toMatch(/hidden|shortened|lot of text/);
  });
});
