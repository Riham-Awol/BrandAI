import { createServer } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma.js";
import { _resetCooldownsForTests, createOpenAICompatibleTextProvider } from "@/server/ai/providers/openai-compatible.js";
import { setProviderOverrides } from "@/server/ai/providers/registry.js";
import { generateText } from "@/server/ai/orchestrator.js";
import { SECTION_SCHEMAS } from "@/modules/launch/schemas.js";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import "@/modules/launch/mock-fixtures.js";
import { createUser } from "../helpers/factories.js";

/**
 * A local HTTP server imitating an OpenAI-compatible provider, so the real
 * fetch path, headers, fallbacks and error mapping are exercised.
 */
let server;
let baseUrl;
let behaviour;
const requests = [];

beforeAll(async () => {
  server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    requests.push({ headers: req.headers, body, path: req.url });
    const { status = 200, json, delayMs = 0 } = behaviour(body, requests.length);
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    if (res.destroyed) return;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(json));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
});
afterAll(() => new Promise((r) => server.close(r)));
afterEach(() => {
  _resetCooldownsForTests();
  requests.length = 0;
  setProviderOverrides(null);
});

const completion = (content, extra = {}) => ({
  json: { model: "free-model-1", choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }], usage: { prompt_tokens: 120, completion_tokens: 80 }, ...extra },
});
const names = mockFixtureResponder({ module: "launch", task: "names" }).data;
const provider = (model = `m-${Math.random()}`) => createOpenAICompatibleTextProvider({ name: "gemini", baseUrl, model, apiKey: "test-key" });
const ask = (p) => p.generate({ system: "sys", prompt: "hello", schema: SECTION_SCHEMAS.names, maxTokens: 1000 });

describe("OpenAI-compatible free provider", () => {
  it("sends a strict json_schema request with bearer auth and parses the result", async () => {
    behaviour = () => completion(JSON.stringify(names));
    const out = await ask(provider());
    expect(out.data).toEqual(names);
    expect(out.usage).toEqual({ inputTokens: 120, outputTokens: 80 });
    expect(requests[0].path).toBe("/v1/chat/completions");
    expect(requests[0].headers.authorization).toBe("Bearer test-key");
    expect(requests[0].body.response_format.type).toBe("json_schema");
    expect(requests[0].body.response_format.json_schema.schema.properties.suggestions.type).toBe("array");
    expect(requests[0].body.messages[0]).toEqual({ role: "system", content: "sys" });
  });

  it("falls back to json_object when json_schema is unsupported, and remembers it", async () => {
    behaviour = (body) => (body.response_format?.type === "json_schema" ? { status: 400, json: { error: "unsupported response_format" } } : completion("```json\n" + JSON.stringify(names) + "\n```"));
    const p = provider("fallback-model");
    expect((await ask(p)).data).toEqual(names);
    expect(requests.map((r) => r.body.response_format?.type)).toEqual(["json_schema", "json_object"]);
    expect(requests[1].body.messages[0].content).toContain("JSON Schema");
    requests.length = 0;
    await ask(p);
    expect(requests.map((r) => r.body.response_format?.type)).toEqual(["json_object"]);
  });

  it("asks the model to repair invalid JSON once", async () => {
    behaviour = (_b, n) => (n === 1 ? completion('{"suggestions": "oops"}') : completion(JSON.stringify(names)));
    const out = await ask(provider());
    expect(out.data).toEqual(names);
    expect(requests).toHaveLength(2);
    expect(requests[1].body.messages.at(-1).content).toMatch(/did not match the schema[\s\S]*suggestions/);
    expect(out.usage.inputTokens).toBe(240);
  });

  it("maps rate limits, auth failures and truncation to clear errors", async () => {
    behaviour = () => ({ status: 429, json: {} });
    await expect(ask(provider())).rejects.toMatchObject({ code: "AI_PROVIDER_BUSY", status: 503 });
    behaviour = () => ({ status: 401, json: {} });
    await expect(ask(provider())).rejects.toMatchObject({ code: "AI_PROVIDER_AUTH" });
    behaviour = () => completion("{", { choices: [{ message: { content: "{" }, finish_reason: "length" }] });
    await expect(ask(provider())).rejects.toMatchObject({ code: "AI_OUTPUT_TRUNCATED" });
  });

  it("moves to the next free model when one is retired, overloaded or rate-limited", async () => {
    behaviour = (body) =>
      body.model === "retired" ? { status: 404, json: { error: "no longer available" } }
      : body.model === "busy" ? { status: 503, json: { error: "high demand" } }
      : body.model === "limited" ? { status: 429, json: {} }
      : completion(JSON.stringify(names));
    const p = createOpenAICompatibleTextProvider({ name: "gemini", baseUrl, model: "retired", fallbackModels: ["busy", "limited", "works"], apiKey: "k" });
    expect((await ask(p)).data).toEqual(names);
    expect(requests.map((r) => r.body.model)).toEqual(["retired", "busy", "limited", "works"]);

    behaviour = () => ({ status: 503, json: {} });
    const allBusy = createOpenAICompatibleTextProvider({ name: "gemini", baseUrl, model: "a", fallbackModels: ["b"], apiKey: "k", retryDelayMs: 10 });
    await expect(ask(allBusy)).rejects.toMatchObject({ code: "AI_MODEL_UNAVAILABLE", status: 503 });
  });

  it("makes a second pass over overloaded models after a short wait, but not over quota-limited ones", async () => {
    let busyUntil = 3;
    behaviour = (body, n) => (body.model === "quota" ? { status: 429, json: {} } : n <= busyUntil ? { status: 503, json: {} } : completion(JSON.stringify(names)));
    const p = createOpenAICompatibleTextProvider({ name: "gemini", baseUrl, model: "a", fallbackModels: ["quota", "b"], apiKey: "k", retryDelayMs: 20 });
    expect((await ask(p)).data).toEqual(names);
    expect(requests.map((r) => r.body.model)).toEqual(["a", "quota", "b", "a"]);
  });

  it("abandons a hung model after the attempt timeout and remembers it", async () => {
    behaviour = (body) => (body.model === "slow" ? { delayMs: 1500, ...completion("{}") } : completion(JSON.stringify(names)));
    const p = createOpenAICompatibleTextProvider({ name: "gemini", baseUrl, model: "slow", fallbackModels: ["fast"], apiKey: "k", attemptTimeoutMs: 300 });
    const t = Date.now();
    expect((await ask(p)).data).toEqual(names);
    expect(Date.now() - t).toBeLessThan(1500);
    requests.length = 0;
    // The slow model is cooling down, so the next request goes straight to the fast one.
    expect((await ask(p)).data).toEqual(names);
    expect(requests.map((r) => r.body.model)).toEqual(["fast"]);
  });

  it("stops trying further models after the overall deadline", async () => {
    behaviour = () => ({ delayMs: 400, ...completion("{}") });
    const p = createOpenAICompatibleTextProvider({ name: "gemini", baseUrl, model: "a", fallbackModels: ["b", "c", "d"], apiKey: "k", attemptTimeoutMs: 150, deadlineMs: 200 });
    await expect(ask(p)).rejects.toMatchObject({ code: "AI_MODEL_TIMEOUT", status: 504 });
    expect(requests.length).toBeLessThan(4);
  });

  it("treats Gemini's 'valid API key' 400 as an authentication error", async () => {
    behaviour = () => ({ status: 400, json: [{ error: { code: 400, message: "Please pass a valid API key" } }] });
    await expect(ask(provider())).rejects.toMatchObject({ code: "AI_PROVIDER_AUTH" });
    expect(requests).toHaveLength(1);
  });

  it("reports SERVICE_NOT_CONFIGURED when the key is missing", async () => {
    const p = createOpenAICompatibleTextProvider({ name: "gemini", baseUrl, model: "m", missing: ["GEMINI_API_KEY"] });
    expect(p.configured).toBe(false);
    await expect(ask(p)).rejects.toMatchObject({ code: "SERVICE_NOT_CONFIGURED", message: expect.stringContaining("GEMINI_API_KEY") });
  });

  it("works end to end through the orchestrator, recording tokens at zero cost", async () => {
    behaviour = () => completion(JSON.stringify(names));
    setProviderOverrides({ text: provider() });
    const { user, workspace } = await createUser();
    const result = await generateText({ user, workspaceId: workspace.id, module: "launch", task: "names", input: "bakery", schema: SECTION_SCHEMAS.names });
    expect(result).toMatchObject({ isMock: false, model: "free-model-1", data: names });
    const usage = await prisma.aiUsageRecord.findFirst({ where: { workspaceId: workspace.id } });
    expect(usage).toMatchObject({ provider: "gemini", inputTokens: 120, outputTokens: 80, costMicroUsd: 0n });
    expect(requests[0].body.messages[1].content).toContain("<user_input>\nbakery\n</user_input>");
  });
});
