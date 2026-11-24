import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseFallbackProviders, resolvePreset } from "@/server/ai/providers/presets.js";
import { createFallbackTextProvider } from "@/server/ai/providers/fallback.js";
import { AppError, Errors } from "@/server/errors.js";
import { extractJson, toJsonSchema } from "@/server/ai/providers/openai-compatible.js";
import { SECTION_SCHEMAS as LAUNCH } from "@/modules/launch/schemas.js";
import { SECTION_SCHEMAS as BRAND } from "@/modules/brand/schemas.js";

describe("provider presets", () => {
  it("resolves the free Gemini preset and reports a missing key", () => {
    const gemini = resolvePreset("gemini", {});
    expect(gemini).toMatchObject({ baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-flash-latest", missing: ["GEMINI_API_KEY"] });
    expect(gemini.fallbackModels.length).toBeGreaterThan(0);
    // An explicit model disables the built-in fallbacks unless fallbacks are also configured.
    expect(resolvePreset("gemini", { GEMINI_API_KEY: "k", AI_TEXT_MODEL: "gemini-x" })).toMatchObject({ apiKey: "k", model: "gemini-x", fallbackModels: [], missing: [] });
    expect(resolvePreset("gemini", { AI_TEXT_MODEL: "a", AI_TEXT_FALLBACK_MODELS: "b, a ,c" }).fallbackModels).toEqual(["b", "c"]);
  });
  it("lets Ollama run without a key and custom endpoints override the URL", () => {
    expect(resolvePreset("ollama", {}).missing).toEqual([]);
    expect(resolvePreset("openai_compatible", {}).missing).toEqual(["AI_BASE_URL", "AI_TEXT_MODEL"]);
    expect(resolvePreset("openai_compatible", { AI_BASE_URL: "http://x/v1/", AI_TEXT_MODEL: "m" })).toMatchObject({ baseUrl: "http://x/v1", missing: [] });
    expect(resolvePreset("nope", {})).toBeNull();
  });
});

describe("OpenRouter free-only guard and provider fallback", () => {
  it("never selects paid OpenRouter models", () => {
    const free = resolvePreset("openrouter", { OPENROUTER_API_KEY: "k" });
    expect(free.missing).toEqual([]);
    expect([free.model, ...free.fallbackModels].every((m) => m.endsWith(":free"))).toBe(true);
    const paid = resolvePreset("openrouter", { OPENROUTER_API_KEY: "k", AI_TEXT_MODEL: "openai/gpt-5", AI_TEXT_FALLBACK_MODELS: "x/paid,y/ok:free" });
    expect(paid.model).toBeNull();
    expect(paid.fallbackModels).toEqual(["y/ok:free"]);
    expect(paid.missing[0]).toMatch(/:free/);
  });

  it("applies model/endpoint overrides to the primary provider only", () => {
    const env = { GEMINI_API_KEY: "g", OPENROUTER_API_KEY: "o", AI_TEXT_MODEL: "gemini-x", AI_BASE_URL: "http://custom/v1", AI_API_KEY: "shared" };
    const fallback = resolvePreset("openrouter", env, { primary: false });
    expect(fallback).toMatchObject({ baseUrl: "https://openrouter.ai/api/v1", apiKey: "o", missing: [] });
    expect(fallback.model.endsWith(":free")).toBe(true);
    expect(resolvePreset("groq", env, { primary: false }).missing).toEqual(["GROQ_API_KEY"]);
    expect(parseFallbackProviders("openrouter, groq,gemini,nope,openrouter", "gemini")).toEqual(["openrouter", "groq"]);
    expect(parseFallbackProviders("", "gemini")).toEqual([]);
  });

  const fake = (name, behaviour, configured = true) => ({
    name, configured, calls: [],
    async generate(req) {
      this.calls.push(req);
      if (behaviour instanceof Error) throw behaviour;
      return { text: name, data: null, model: `${name}-model`, usage: { inputTokens: 1, outputTokens: 1 } };
    },
  });

  it("falls through busy providers and reports which one answered", async () => {
    const gemini = fake("gemini", new AppError("AI_PROVIDER_BUSY", "busy", 503));
    const openrouter = fake("openrouter", null);
    const chain = createFallbackTextProvider([gemini, openrouter]);
    const result = await chain.generate({ prompt: "p", model: "gemini-x" });
    expect(result).toMatchObject({ provider: "openrouter", model: "openrouter-model" });
    expect(gemini.calls[0].model).toBe("gemini-x");
    expect(openrouter.calls[0].model).toBeUndefined();
    expect(gemini.calls[0].deadlineMs).toBeLessThan(openrouter.calls[0].deadlineMs + 1000);
  });

  it("skips unconfigured providers and does not retry on non-capacity errors", async () => {
    const off = fake("gemini", null, false);
    const openrouter = fake("openrouter", null);
    expect(await createFallbackTextProvider([off, openrouter]).generate({})).toMatchObject({ provider: "openrouter" });
    expect(off.calls).toHaveLength(0);
    expect(createFallbackTextProvider([fake("a", null, false), fake("b", null, false)]).configured).toBe(false);

    const bad = fake("gemini", new AppError("AI_INVALID_OUTPUT", "bad", 502));
    const next = fake("openrouter", null);
    await expect(createFallbackTextProvider([bad, next]).generate({})).rejects.toMatchObject({ code: "AI_INVALID_OUTPUT" });
    expect(next.calls).toHaveLength(0);

    const last = fake("openrouter", Errors.upstream());
    await expect(createFallbackTextProvider([fake("gemini", new AppError("AI_MODEL_TIMEOUT", "t", 504)), last]).generate({})).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });
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
