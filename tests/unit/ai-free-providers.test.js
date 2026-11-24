import { describe, expect, it } from "vitest";
import { z } from "zod";
import { resolvePreset } from "@/server/ai/providers/presets.js";
import { extractJson, toJsonSchema } from "@/server/ai/providers/openai-compatible.js";
import { SECTION_SCHEMAS as LAUNCH } from "@/modules/launch/schemas.js";
import { SECTION_SCHEMAS as BRAND } from "@/modules/brand/schemas.js";

describe("provider presets", () => {
  it("resolves the free Gemini preset and reports a missing key", () => {
    expect(resolvePreset("gemini", {})).toMatchObject({ baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash", missing: ["GEMINI_API_KEY"] });
    expect(resolvePreset("gemini", { GEMINI_API_KEY: "k", AI_TEXT_MODEL: "gemini-x" })).toMatchObject({ apiKey: "k", model: "gemini-x", missing: [] });
  });
  it("lets Ollama run without a key and custom endpoints override the URL", () => {
    expect(resolvePreset("ollama", {}).missing).toEqual([]);
    expect(resolvePreset("openai_compatible", {}).missing).toEqual(["AI_BASE_URL", "AI_TEXT_MODEL"]);
    expect(resolvePreset("openai_compatible", { AI_BASE_URL: "http://x/v1/", AI_TEXT_MODEL: "m" })).toMatchObject({ baseUrl: "http://x/v1", missing: [] });
    expect(resolvePreset("nope", {})).toBeNull();
  });
});

describe("JSON handling", () => {
  it("extracts JSON from fences and surrounding prose", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! Here it is: {"a":[1,2]} Hope that helps.')).toEqual({ a: [1, 2] });
    expect(extractJson("not json")).toBeUndefined();
    expect(extractJson(undefined)).toBeUndefined();
  });
  it("converts every studio schema to JSON Schema without $schema", () => {
    for (const schema of [...Object.values(LAUNCH), ...Object.values(BRAND)]) {
      const json = toJsonSchema(schema);
      expect(json.$schema).toBeUndefined();
      expect(json.type).toBe("object");
    }
    expect(toJsonSchema(z.object({ a: z.string().describe("d") })).properties.a.description).toBe("d");
  });
});
