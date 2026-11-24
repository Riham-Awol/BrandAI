import { describe, expect, it } from "vitest";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import "@/modules/brand/mock-fixtures.js";
import "@/modules/stationery/mock-fixtures.js";
import { contrastRatio } from "@/modules/brand/color.js";
import { DEFAULT_BRAND } from "@/server/design/renderer.js";
import { MATERIAL_KINDS, MATERIAL_KIND_KEYS, PRODUCT_COLOR_KEYS } from "@/modules/stationery/catalog.js";
import { aiMaterialOptionsSchema, materialSpecSchema } from "@/modules/stationery/schemas.js";
import { blankSpec, normalizeMaterialSpec, templateOptions } from "@/modules/stationery/spec-utils.js";
import { computeTotals, currencyDecimals, formatMoney, formatQuantity, parseDecimal, taxBreakdown } from "@/modules/stationery/money.js";
import { TRANSITIONS, aiDocumentTextSchema, documentInputSchema, isOverdue } from "@/modules/stationery/documents.js";
import { addressLines, businessDetailsSchema } from "@/modules/stationery/details.js";
import { PROFILE_SCHEMAS } from "@/modules/stationery/profile-schemas.js";
import { PROFILE_SECTIONS } from "@/modules/stationery/profile-sections.js";
import { inkFor, productHex, renderMaterial } from "@/server/stationery/renderer.js";

const concept = mockFixtureResponder({ module: "brand", task: "logo_concepts" }).data.concepts[0];
const brandWithLogo = { ...DEFAULT_BRAND, name: "Kirkgate Bakery", logo: concept };
const details = { legalName: "Kirkgate Bakery Ltd", addressLine1: "Kirkgate Market", city: "Leeds", postcode: "LS2 7HN", country: "UK", email: "hi@k.example", phone: "+44 113 000", website: "https://k.example", registrationNumber: "123", taxNumber: "GB1" };

describe("money", () => {
  it("parses decimals strictly per currency", () => {
    expect(parseDecimal("12.5", 2)).toBe(1250n);
    expect(parseDecimal("1,200.05", 2)).toBe(120005n);
    expect(parseDecimal("1.005", 2)).toBeNull();
    expect(parseDecimal("-1", 2)).toBeNull();
    expect(parseDecimal("abc", 2)).toBeNull();
    expect(currencyDecimals("JPY")).toBe(0);
    expect(currencyDecimals("GBP")).toBe(2);
  });

  it("computes per-line totals with half-up rounding and integer maths", () => {
    const t = computeTotals([{ quantity: "2.5", unitPrice: "12.99", taxRate: 20 }, { quantity: "1", unitPrice: "0.05", taxRate: 20 }, { quantity: "3", unitPrice: "1000", taxRate: 0 }], "GBP");
    expect(t.lines.map((l) => l.netMinor)).toEqual([3248n, 5n, 300000n]);
    expect([t.subtotalMinor, t.taxMinor, t.totalMinor]).toEqual([303253n, 651n, 303904n]);
    expect(taxBreakdown(t.lines)).toEqual([{ rate: 20, amount: 651n }]);
    expect(computeTotals([{ quantity: "0.1", unitPrice: "0.1", taxRate: 0 }, { quantity: "0.2", unitPrice: "0.1", taxRate: 0 }], "GBP").subtotalMinor).toBe(3n);
    expect(() => computeTotals([{ quantity: "x", unitPrice: "1", taxRate: 0 }], "GBP")).toThrow();
  });

  it("formats money exactly, including large and zero-decimal amounts", () => {
    expect(formatMoney(303904n, "GBP")).toBe("£3,039.04");
    expect(formatMoney("123456", "JPY")).toBe("JP¥123,456");
    expect(formatMoney(-150n, "EUR")).toBe("-€1.50");
    expect(formatMoney(9_999_999_999_99n, "USD")).toBe("US$9,999,999,999.99");
    expect(formatQuantity("2.500")).toBe("2.5");
  });
});

describe("documents", () => {
  const base = { businessId: "6f1c1b5e-4b7a-4c55-9a1e-0d6c6b2f8a11", type: "INVOICE", customer: { name: "Café" }, issueDate: "2026-11-24", currency: "GBP", lines: [{ description: "Bread", quantity: "2", unitPrice: "4.50", taxRate: 20 }] };
  it("validates lines, prices per currency and dates", () => {
    expect(documentInputSchema.safeParse(base).success).toBe(true);
    expect(documentInputSchema.safeParse({ ...base, currency: "JPY" }).success).toBe(false);
    expect(documentInputSchema.safeParse({ ...base, lines: [] }).success).toBe(false);
    expect(documentInputSchema.safeParse({ ...base, lines: [{ ...base.lines[0], quantity: "0" }] }).success).toBe(false);
    expect(documentInputSchema.safeParse({ ...base, dueDate: "2026-11-01" }).success).toBe(false);
    expect(documentInputSchema.safeParse({ ...base, issueDate: "2026-02-30" }).success).toBe(false);
  });
  it("defines status rules and overdue detection", () => {
    expect(TRANSITIONS.INVOICE.DRAFT).toContain("SENT");
    expect(TRANSITIONS.INVOICE.VOID).toEqual([]);
    expect(TRANSITIONS.QUOTE.SENT).toContain("ACCEPTED");
    expect(isOverdue({ type: "INVOICE", status: "SENT", dueDate: "2026-01-01" }, "2026-02-01")).toBe(true);
    expect(isOverdue({ type: "INVOICE", status: "PAID", dueDate: "2026-01-01" }, "2026-02-01")).toBe(false);
    expect(isOverdue({ type: "QUOTE", status: "SENT", dueDate: "2026-01-01" }, "2026-02-01")).toBe(false);
  });
  it("AI document text fixture passes its schema", () => {
    expect(aiDocumentTextSchema.safeParse(mockFixtureResponder({ module: "stationery", task: "document_text" }).data).success).toBe(true);
  });
});

describe("business details", () => {
  it("validates and formats address lines", () => {
    const d = businessDetailsSchema.parse({ currency: "gbp", defaultTaxRate: "20", paymentTermsDays: "14", invoicePrefix: "INV-", quotePrefix: "Q/", nextInvoiceNumber: "5", nextQuoteNumber: 1, email: "", website: "www.k.example" });
    expect(d).toMatchObject({ currency: "GBP", defaultTaxRate: 20, email: undefined });
    expect(businessDetailsSchema.safeParse({ ...d, invoicePrefix: "<x>" }).success).toBe(false);
    expect(addressLines(details)).toEqual(["Kirkgate Market", "Leeds LS2 7HN", "UK"]);
  });
});

describe("material specs", () => {
  it("normalizes garbage AI choices to valid keys for the kind", () => {
    const ai = mockFixtureResponder({ module: "stationery", task: "materials" }).data;
    expect(aiMaterialOptionsSchema.safeParse(ai).success).toBe(true);
    for (const kind of MATERIAL_KIND_KEYS) {
      for (const option of ai.options) {
        const spec = normalizeMaterialSpec(kind, option, blankSpec(kind));
        expect(materialSpecSchema.safeParse(spec).success).toBe(true);
        if (MATERIAL_KINDS[kind].templates) expect(MATERIAL_KINDS[kind].templates).toContain(spec.template);
        if (MATERIAL_KINDS[kind].placements) expect(MATERIAL_KINDS[kind].placements).toContain(spec.placement);
      }
    }
    expect(normalizeMaterialSpec("TSHIRT", { placement: "left chest" }).placement).toBe("left_chest");
  });
  it("offers three template layouts for stationery", () => {
    const opts = templateOptions("BUSINESS_CARD", blankSpec("BUSINESS_CARD"));
    expect(opts.map((o) => o.template)).toEqual(["classic", "centered", "split"]);
    expect(new Set(opts.map((o) => o.colorway)).size).toBe(3);
  });
});

describe("stationery renderer", () => {
  it("renders every kind/template/placement at physical size without invalid numbers", async () => {
    for (const kind of MATERIAL_KIND_KEYS) {
      const k = MATERIAL_KINDS[kind];
      for (const variant of k.templates ?? k.placements) {
        const spec = { ...blankSpec(kind), ...(k.templates ? { template: variant } : { placement: variant }), person: { name: "Amira Shah", title: "Baker", phone: "1", email: "a@b.c" }, productName: "Rye", descriptor: "Dense", details: [{ label: "Net weight", value: "800 g" }], slogan: "Proper bread", backText: "Text." };
        for (const brand of [brandWithLogo, { ...DEFAULT_BRAND, name: "No Logo" }]) {
          const { views } = await renderMaterial({ kind, spec, brand, details });
          for (const v of views) {
            expect(v.svg.startsWith("<svg")).toBe(true);
            expect(v.svg).not.toMatch(/NaN|undefined|Infinity/);
            if (v.print) expect(v.svg).toContain(`width="${v.widthMm}mm" height="${v.heightMm}mm"`);
          }
        }
      }
    }
  }, 120_000);

  it("business cards include 3 mm bleed and never emit user text as markup", async () => {
    const spec = { ...blankSpec("BUSINESS_CARD"), person: { name: '<script>alert(1)</script>', title: "x", phone: "", email: "" } };
    const { views } = await renderMaterial({ kind: "BUSINESS_CARD", spec, brand: brandWithLogo, details });
    expect(views.map((v) => [v.widthMm, v.heightMm])).toEqual([[91, 61], [91, 61]]);
    for (const v of views) expect(v.svg).not.toMatch(/<script|onerror|javascript:/i);
  });

  it("prints merch artwork in an ink that contrasts with the product", () => {
    for (const color of PRODUCT_COLOR_KEYS) {
      const product = productHex(color, brandWithLogo);
      expect(contrastRatio(inkFor(product, brandWithLogo), product)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("company profile", () => {
  it("fixtures pass their section schemas", () => {
    for (const s of PROFILE_SECTIONS) expect(PROFILE_SCHEMAS[s.key].safeParse(mockFixtureResponder({ module: "company_profile", task: s.key }).data).success).toBe(true);
  });
});
