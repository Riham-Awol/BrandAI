import { describe, expect, it } from "vitest";
import { exampleText, examplesBlock } from "@/server/ai/memory.js";

describe("AI memory prompt block", () => {
  it("is empty without examples", () => {
    expect(examplesBlock([])).toBe("");
  });
  it("lists examples newest first, marks edited ones and states they're style references", () => {
    const block = examplesBlock([{ source: "EDITED", content: { names: ["Crumb"] } }, { source: "APPROVED", content: "Fresh rye today" }]);
    expect(block).toMatch(/^<approved_examples>/);
    expect(block).toContain('<example n="1" edited_by_the_business="true">');
    expect(block).toContain('<example n="2" >\nFresh rye today');
    expect(block).toContain("style references only");
    expect(block).toContain("only reuse facts that also appear in the business context");
  });
  it("caps each example's size", () => {
    expect(exampleText("x".repeat(5000))).toHaveLength(1501);
    expect(exampleText({ a: 1 })).toBe('{\n "a": 1\n}');
  });
});
