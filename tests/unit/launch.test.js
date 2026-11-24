import { describe, expect, it } from "vitest";
import { SECTION_SCHEMAS, SECTION_KEYS, createLaunchProjectSchema, checklistStateSchema } from "@/modules/launch/schemas.js";
import { LAUNCH_SECTIONS } from "@/modules/launch/sections.js";
import { buildInstructions, buildSectionInput, renderIdeaInput } from "@/modules/launch/prompts.js";
import { renderLaunchPackMarkdown } from "@/modules/launch/markdown.js";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import "@/modules/launch/mock-fixtures.js";
import { emptyValue, schemaToSpec, setAtPath } from "@/components/structured/schema-spec.js";
import { humanize } from "@/lib/humanize.js";

const IDEA = { idea: "A neighbourhood sourdough bakery.", country: "United Kingdom", city: "Leeds", stage: "IDEA", budget: "10k_50k" };

describe("launch section definitions", () => {
  it("defines a schema for every section and only references earlier sections", () => {
    expect(LAUNCH_SECTIONS.map((s) => s.key)).toEqual(SECTION_KEYS);
    LAUNCH_SECTIONS.forEach((s, i) => {
      for (const dep of s.uses) expect(SECTION_KEYS.indexOf(dep)).toBeLessThan(i);
    });
  });

  it("keeps every mock fixture valid against its section schema", () => {
    for (const key of SECTION_KEYS) {
      const { data } = mockFixtureResponder({ module: "launch", task: key });
      expect(SECTION_SCHEMAS[key].safeParse(data).success, key).toBe(true);
    }
  });

  it("returns no data for unknown fixtures", () => {
    expect(mockFixtureResponder({ module: "x", task: "y" }).data).toBeNull();
  });
});

describe("launch input validation", () => {
  it("treats an empty businessId as a new business", () => {
    const r = createLaunchProjectSchema.parse({ ...IDEA, businessId: "", businessName: "" });
    expect(r.businessId).toBeUndefined();
    expect(r.businessName).toBeUndefined();
  });

  it("requires a meaningful idea and a country", () => {
    expect(createLaunchProjectSchema.safeParse({ ...IDEA, idea: "short" }).success).toBe(false);
    expect(createLaunchProjectSchema.safeParse({ ...IDEA, country: "" }).success).toBe(false);
    expect(createLaunchProjectSchema.safeParse({ ...IDEA, businessId: "not-a-uuid" }).success).toBe(false);
  });

  it("validates checklist item ids", () => {
    expect(checklistStateSchema.safeParse({ completed: ["0-1", "12-3"] }).success).toBe(true);
    expect(checklistStateSchema.safeParse({ completed: ["../x"] }).success).toBe(false);
  });
});

describe("prompt building", () => {
  it("renders the idea with location and budget label", () => {
    const text = renderIdeaInput(IDEA);
    expect(text).toContain("Location: Leeds, United Kingdom");
    expect(text).toContain("Budget: $10,000 – $50,000");
  });

  it("includes previous results and revision requests only when given", () => {
    const plain = buildSectionInput({ input: IDEA, previous: {} });
    expect(plain).not.toContain("previous_result");
    expect(plain).not.toContain("revision_request");
    const revised = buildSectionInput({ input: IDEA, previous: { industry: { a: 1 } }, feedback: "Shorter", currentContent: { x: 1 } });
    expect(revised).toContain('<previous_result section="industry">\n{"a":1}');
    expect(revised).toContain("<current_version>");
    expect(revised).toContain("<revision_request>\nShorter");
  });

  it("builds task-specific instructions that forbid invented facts", () => {
    expect(buildInstructions("competitors")).toMatch(/Do not invent statistics, sources, URLs/);
    expect(buildInstructions("competitors")).toContain("Competitor research");
  });
});

describe("markdown export", () => {
  it("renders sections in order and escapes markdown in content", () => {
    const md = renderLaunchPackMarkdown({
      project: { input: IDEA },
      business: { name: "Crumb *Co*" },
      outputs: {
        names: { isMock: false, content: { suggestions: [{ name: "A", tagline: "t", style: "abstract", rationale: "r" }], namingNotes: "# not a heading" } },
        idea_analysis: { isMock: true, content: { summary: "S", viabilityScore: 70, verdict: "strong", strengths: ["x"], weaknesses: [], opportunities: [], threats: [], keyAssumptions: [], recommendedNextSteps: [] } },
      },
    });
    expect(md.indexOf("## Idea analysis")).toBeLessThan(md.indexOf("## Business names"));
    expect(md).toContain("# Crumb \\*Co\\* — Launch Pack");
    expect(md).toContain("\\# not a heading");
    expect(md).toContain("mock AI provider");
  });
});

describe("structured editor helpers", () => {
  const spec = schemaToSpec(SECTION_SCHEMAS.names);

  it("derives a field spec from a zod schema", () => {
    expect(spec.kind).toBe("object");
    const suggestions = spec.fields.find((f) => f.key === "suggestions");
    expect(suggestions.kind).toBe("array");
    expect(suggestions.item.fields.find((f) => f.key === "style").options).toContain("abstract");
    expect(spec.fields.find((f) => f.key === "namingNotes").description).toMatch(/trademarks/);
  });

  it("creates empty values that match the shape", () => {
    expect(emptyValue(spec.fields[0].item)).toEqual({ name: "", tagline: "", style: "descriptive", rationale: "" });
  });

  it("sets values immutably by path", () => {
    const value = { a: [{ b: 1 }, { b: 2 }] };
    const next = setAtPath(value, ["a", 1, "b"], 3);
    expect(next).toEqual({ a: [{ b: 1 }, { b: 3 }] });
    expect(value.a[1].b).toBe(2);
  });

  it("humanizes keys", () => {
    expect(humanize("viabilityScore")).toBe("Viability score");
    expect(humanize("mid_market")).toBe("Mid market");
    expect(humanize("naicsCode")).toBe("NAICS code");
  });
});
