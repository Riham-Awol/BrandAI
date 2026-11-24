import { describe, expect, it } from "vitest";
import { estimateTextCostMicroUsd } from "@/server/ai/pricing.js";
import { pickApprovedSections, renderContextForPrompt } from "@/server/businesses/context-utils.js";
import { periodStart } from "@/server/usage/period.js";

describe("AI cost estimation", () => {
  it("computes micro-USD from per-MTok prices", () => {
    // claude-opus-5-5: $4 in / $20 out per MTok → 1000 in + 500 out = 4000 + 10000 micro-USD
    expect(estimateTextCostMicroUsd("claude-opus-5-5", { inputTokens: 1000, outputTokens: 500 })).toBe(14_000n);
  });
  it("prices cache reads/writes", () => {
    expect(estimateTextCostMicroUsd("claude-opus-5-5", { cacheReadTokens: 1000, cacheWriteTokens: 1000 })).toBe(5_400n);
  });
  it("returns 0 for unknown models rather than guessing", () => {
    expect(estimateTextCostMicroUsd("unknown-model", { inputTokens: 1e6 })).toBe(0n);
  });
});

describe("business context helpers", () => {
  const data = { basics: { name: "Acme" }, audience: { who: "SMBs" }, goals: null };

  it("only exposes approved sections", () => {
    expect(pickApprovedSections(data, ["basics"])).toEqual({ basics: { name: "Acme" } });
    expect(pickApprovedSections(data, [])).toEqual({});
    expect(pickApprovedSections(data, "basics")).toEqual({});
  });

  it("renders deterministic prompt blocks", () => {
    const a = renderContextForPrompt({ version: 2, data: { b: 1, a: 2 } });
    const b = renderContextForPrompt({ version: 2, data: { a: 2, b: 1 } });
    expect(a).toBe(b);
    expect(a).toContain('<business_context version="2">');
    expect(renderContextForPrompt(null)).toBe("");
  });
});

describe("usage periods", () => {
  it("starts monthly periods on the 1st (UTC)", () => {
    expect(periodStart("MONTHLY", new Date("2026-11-24T15:00:00Z")).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(periodStart("DAILY", new Date("2026-11-24T15:00:00Z")).toISOString()).toBe("2026-11-24T00:00:00.000Z");
  });
});
