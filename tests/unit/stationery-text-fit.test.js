import { expect, it } from "vitest";
import { DEFAULT_BRAND } from "@/server/design/renderer.js";
import { renderMaterial } from "@/server/stationery/renderer.js";
import { blankSpec } from "@/modules/stationery/spec-utils.js";

// Regression (live run 2026-11-24): long business names were truncated ("Kirkga te…") without a logo.
it("fits long business names on merch without truncating when no logo is approved", async () => {
  const brand = { ...DEFAULT_BRAND, name: "Kirkgate Sourdough Bakehouse" };
  for (const [placement, artwork] of [["full_front", "logo"], ["left_chest", "logo"], ["center_chest", "wordmark"], ["back", "logo_mark"]]) {
    const { views } = await renderMaterial({ kind: "TSHIRT", spec: { ...blankSpec("TSHIRT"), placement, artwork }, brand, details: {} });
    for (const v of views) expect(v.svg).not.toContain("…");
  }
});
