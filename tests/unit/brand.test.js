import { describe, expect, it } from "vitest";
import { icons } from "lucide";
import { existsSync } from "node:fs";
import { contrastRatio, contrastRating, normalizeHex, readableOn } from "@/modules/brand/color.js";
import { FONTS, nearestWeight } from "@/modules/brand/catalog/fonts.js";
import { ICON_NAMES } from "@/modules/brand/catalog/icons.js";
import { SECTION_SCHEMAS, SECTION_KEYS, createBrandProjectSchema } from "@/modules/brand/schemas.js";
import { BRAND_SECTIONS } from "@/modules/brand/sections.js";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import "@/modules/brand/mock-fixtures.js";
import { normalizeConcept, postProcessBrand } from "@/modules/brand/service.js";
import { assembleIdentity, identityToContext } from "@/modules/brand/identity-service.js";
import { selectedOrAll } from "@/modules/brand/prompts.js";
import { applyCase, renderLogoSvg } from "@/server/brand/logo-renderer.js";
import { fontFilePath } from "@/server/brand/fonts.js";

const concept = mockFixtureResponder({ module: "brand", task: "logo_concepts" }).data.concepts[0];

describe("colour", () => {
  it("normalizes hex values", () => {
    expect(normalizeHex(" #ABC ")).toBe("#aabbcc");
    expect(normalizeHex("7A4B2A")).toBe("#7a4b2a");
    expect(normalizeHex("brown")).toBeNull();
    expect(normalizeHex("#12345")).toBeNull();
  });
  it("computes WCAG contrast", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
    expect(contrastRating(4.5)).toBe("AA");
    expect(contrastRating(2)).toBe("Fail");
    expect(readableOn("#111111")).toBe("#ffffff");
    expect(readableOn("#fafafa")).toBe("#17151c");
  });
});

describe("catalogs", () => {
  it("bundles a font file for every catalog weight", () => {
    for (const f of FONTS) for (const w of f.weights) expect(existsSync(fontFilePath(f.key, w)), `${f.key} ${w}`).toBe(true);
  });
  it("picks the nearest available weight", () => {
    expect(nearestWeight("pacifico", "900")).toBe(400);
    expect(nearestWeight("lora", "800")).toBe(700);
    expect(nearestWeight("unknown", "700")).toBe(400);
  });
  it("only lists icons that exist in Lucide", () => {
    expect(ICON_NAMES.filter((n) => !icons[n])).toEqual([]);
  });
});

describe("brand sections and fixtures", () => {
  it("keeps fixtures valid and sections ordered", () => {
    expect(BRAND_SECTIONS.map((s) => s.key)).toEqual(SECTION_KEYS);
    BRAND_SECTIONS.forEach((s, i) => s.uses.forEach((d) => expect(SECTION_KEYS.indexOf(d)).toBeLessThan(i)));
    for (const key of SECTION_KEYS) {
      const { data } = mockFixtureResponder({ module: "brand", task: key });
      expect(SECTION_SCHEMAS[key].safeParse(data).success, key).toBe(true);
      expect(() => postProcessBrand(key, data)).not.toThrow();
    }
  });
  it("validates project input", () => {
    expect(createBrandProjectSchema.safeParse({ businessId: crypto.randomUUID(), styleKeywords: ["bold", "minimal"] }).success).toBe(true);
    expect(createBrandProjectSchema.safeParse({ businessId: crypto.randomUUID(), styleKeywords: ["weird"] }).success).toBe(false);
  });
  it("passes only the selected option to later prompts", () => {
    const palettes = mockFixtureResponder({ module: "brand", task: "palettes" }).data;
    expect(selectedOrAll("palettes", { content: palettes, state: { selected: 1 } }).selected.name).toBe("Flour");
    expect(selectedOrAll("palettes", { content: palettes, state: { selected: 99 } }).selected.name).toBe("Flour");
    expect(selectedOrAll("personality", { content: { a: 1 } })).toEqual({ a: 1 });
  });
});

describe("normalizeConcept", () => {
  it("repairs unknown icons, clamps values and fixes weights", () => {
    const fixed = normalizeConcept({ ...concept, icon: "croissant", letterSpacing: -3, fontKey: "bebas_neue", fontWeight: "700", monogram: "c<c>x" });
    expect(fixed).toMatchObject({ icon: "Croissant", letterSpacing: -0.05, fontWeight: "400", monogram: "cc" });
    expect(normalizeConcept({ ...concept, icon: "Spaceship" }).markType).toBe("monogram");
    expect(() => normalizeConcept({ ...concept, colors: { ...concept.colors, text: "blue" } })).toThrow();
  });
});

describe("logo renderer", () => {
  it.each([["horizontal", "color"], ["stacked", "mono"], ["mark", "inverse"], ["wordmark", "color"]])("renders %s / %s as outlined, script-free SVG", async (variant, theme) => {
    const { svg, width, height } = await renderLogoSvg(concept, { name: "Crumb & Co", variant, theme, height: 120 });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).not.toMatch(/<script|<text|on\w+=|href=|NaN/i);
    expect(height).toBe(120);
    expect(width).toBeGreaterThan(0);
    if (theme === "inverse") expect(svg).toContain(`fill="${concept.colors.mark}"`);
  });

  it("escapes the business name in the title", async () => {
    const { svg } = await renderLogoSvg(concept, { name: '<img src=x onerror="alert(1)">', variant: "mark" });
    expect(svg).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt; logo");
    expect(svg).not.toContain("<img");
  });

  it("falls back for characters missing from the font and warns", async () => {
    const r = await renderLogoSvg({ ...concept, fontKey: "pacifico", fontWeight: "400" }, { name: "Café Ünited", variant: "wordmark" });
    expect(r.svg).not.toContain("NaN");
    const cjk = await renderLogoSvg(concept, { name: "東京 Bakery", variant: "wordmark" });
    expect(cjk.warnings[0]).toMatch(/Latin only/);
  });

  it("renders name-only concepts without a symbol except in the icon variant", async () => {
    const wordmark = { ...concept, markType: "wordmark", icon: "" };
    const plain = await renderLogoSvg(wordmark, { name: "Crust", variant: "wordmark" });
    for (const variant of ["horizontal", "stacked"]) {
      const { svg } = await renderLogoSvg(wordmark, { name: "Crust", variant });
      expect(svg.match(/<path/g).length).toBe(plain.svg.match(/<path/g).length);
    }
    const mark = await renderLogoSvg(wordmark, { name: "Crust", variant: "mark" });
    expect(mark.svg).toContain("<path");
  });

  it("applies letter case", () => {
    expect(applyCase("crumb and co", "title")).toBe("Crumb And Co");
    expect(applyCase("Crumb", "upper")).toBe("CRUMB");
  });
});

describe("identity", () => {
  const active = Object.fromEntries(SECTION_KEYS.map((k) => [k, { content: postProcessBrand(k, mockFixtureResponder({ module: "brand", task: k }).data), state: k === "palettes" ? { selected: 1 } : null }]));

  it("assembles selections and reports missing sections", () => {
    const { complete, data } = assembleIdentity(active, { name: "Crumb & Co" });
    expect(complete).toBe(true);
    expect(data.palette.name).toBe("Flour");
    expect(data.tagline).toBe("Baked fresh, every morning");
    const partial = assembleIdentity({ personality: active.personality }, { name: "X" });
    expect(partial.complete).toBe(false);
    expect(partial.missing).toContain("Logo");
  });

  it("maps the identity into brandIdentity and brandVoice context sections", () => {
    const ctx = identityToContext(assembleIdentity(active, { name: "Crumb & Co" }).data);
    expect(ctx.brandIdentity).toMatchObject({ paletteName: "Flour", typography: { heading: "Playfair Display 700", body: "Inter 400" }, logo: { style: "icon", icon: "Croissant" } });
    expect(ctx.brandVoice.avoidWords).toEqual(["cheap"]);
  });
});
