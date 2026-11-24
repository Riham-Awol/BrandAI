import { z } from "zod";
import { AppError, Errors } from "../../errors.js";
import { logger } from "../../logger.js";

/**
 * Text provider for any OpenAI-compatible Chat Completions endpoint
 * (Gemini free tier, Groq, OpenRouter, Ollama, …). Uses plain fetch.
 *
 * Structured output strategy, most to least strict:
 *   1. response_format: json_schema (strict)
 *   2. response_format: json_object + schema in the instructions
 *   3. no response_format + schema in the instructions
 * A 400 from the provider downgrades the mode (remembered per endpoint/model).
 * The JSON is validated with the Zod schema; on failure the model gets one
 * repair attempt with the validation errors.
 */
const MODES = ["json_schema", "json_object", "prompt"];
const modeMemory = new Map();
// Per-model attempt limit: a hung free model is abandoned for the next one.
const ATTEMPT_TIMEOUT_MS = 90_000;
// Stop starting new attempts after this, so requests finish within the route's 300 s limit.
const OVERALL_DEADLINE_MS = 200_000;
// Models that were overloaded, rate-limited or timed out are skipped for a while.
const COOLDOWN_MS = 10 * 60_000;
const cooldowns = new Map();

export function _resetCooldownsForTests() {
  cooldowns.clear();
}

export function toJsonSchema(schema) {
  const json = z.toJSONSchema(schema);
  delete json.$schema;
  return json;
}

/** Extracts a JSON value from model text (handles ``` fences and leading prose). */
export function extractJson(text) {
  if (typeof text !== "string") return undefined;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.search(/[[{]/);
    const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (start === -1 || end <= start) return undefined;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
}

function schemaInstructions(jsonSchema) {
  return `Respond with a single JSON object only (no prose, no markdown) that validates against this JSON Schema:\n${JSON.stringify(jsonSchema)}`;
}

function describeIssues(error) {
  return error.issues
    .slice(0, 20)
    .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

/** Errors after which the next model in the fallback chain is tried. */
const TRY_NEXT_MODEL = new Set(["AI_MODEL_UNAVAILABLE", "AI_PROVIDER_BUSY", "AI_MODEL_TIMEOUT"]);

export function createOpenAICompatibleTextProvider({
  name, baseUrl, model: defaultModel, fallbackModels = [], apiKey, missing = [], fetchImpl = fetch,
  attemptTimeoutMs = ATTEMPT_TIMEOUT_MS, deadlineMs = OVERALL_DEADLINE_MS, cooldownMs = COOLDOWN_MS, retryDelayMs = 5_000,
}) {
  if (missing.length) {
    return {
      name,
      configured: false,
      async generate() {
        throw Errors.notConfigured(`AI text generation (${missing.join(", ")} missing)`);
      },
    };
  }

  async function call(body) {
    let res;
    try {
      res = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(attemptTimeoutMs),
      });
    } catch (error) {
      if (error?.name === "TimeoutError") throw new AppError("AI_MODEL_TIMEOUT", "The AI provider took too long to respond. Please try again.", 504);
      throw Errors.upstream("Could not reach the AI provider.");
    }
    if (res.ok) return res.json();
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    // Gemini reports a bad key as HTTP 400 "Please pass a valid API key".
    if (res.status === 401 || res.status === 403 || (res.status === 400 && /api[ _-]?key/i.test(detail))) throw new AppError("AI_PROVIDER_AUTH", "The AI provider rejected the server credentials.", 503);
    if (res.status === 429) throw new AppError("AI_PROVIDER_BUSY", "The free AI provider's rate limit was reached. Please wait a minute and try again.", 503);
    if (res.status === 404 || res.status === 503) throw new AppError("AI_MODEL_UNAVAILABLE", "The AI model is busy or unavailable right now. Please try again shortly.", 503, { providerMessage: detail });
    if (res.status === 400 || res.status === 422) throw new AppError("AI_BAD_REQUEST", "The AI request was rejected.", 502, { providerMessage: detail });
    throw Errors.upstream("The AI provider returned an error.");
  }

  return {
    name,
    configured: true,
    async generate(request) {
      // Requested/default model first, then fallbacks; models cooling down go last.
      const now = Date.now();
      const all = [...new Set([request.model ?? defaultModel, ...fallbackModels])];
      const isCooling = (m) => (cooldowns.get(`${baseUrl}|${m}`) ?? 0) > now;
      const chain = [...all.filter((m) => !isCooling(m)), ...all.filter(isCooling)];
      const started = Date.now();
      let lastError;
      const overloaded = [];
      const attempt = async (model) => {
        const attemptStart = Date.now();
        try {
          return { result: await generateWithModel({ ...request, model }) };
        } catch (error) {
          logger.warn("AI model attempt failed", { provider: name, model, code: error?.code, ms: Date.now() - attemptStart, detail: error?.details?.providerMessage?.slice(0, 160) });
          if (!(error instanceof AppError && TRY_NEXT_MODEL.has(error.code))) throw error;
          cooldowns.set(`${baseUrl}|${model}`, Date.now() + cooldownMs);
          if (error.code === "AI_MODEL_UNAVAILABLE") overloaded.push(model);
          lastError = error;
          return null;
        }
      };
      for (const model of chain) {
        if (lastError && Date.now() - started > deadlineMs) break;
        const outcome = await attempt(model);
        if (outcome) return outcome.result;
      }
      // "High demand" spikes are usually brief: one more pass over overloaded models (not quota-limited ones).
      if (overloaded.length && Date.now() - started + retryDelayMs < deadlineMs) {
        await new Promise((r) => setTimeout(r, retryDelayMs));
        for (const model of [...overloaded]) {
          if (Date.now() - started > deadlineMs) break;
          const outcome = await attempt(model);
          if (outcome) {
            cooldowns.delete(`${baseUrl}|${model}`);
            return outcome.result;
          }
        }
      }
      throw lastError;
    },
  };

  async function generateWithModel({ system, prompt, schema, model, maxTokens = 8000 }) {
      const jsonSchema = schema ? toJsonSchema(schema) : null;
      const memoryKey = `${baseUrl}|${model}`;
      let modeIndex = schema ? MODES.indexOf(modeMemory.get(memoryKey) ?? "json_schema") : 2;
      const usage = { inputTokens: 0, outputTokens: 0 };

      const buildBody = (mode, messages) => ({
        model,
        max_tokens: maxTokens,
        messages,
        ...(mode === "json_schema" ? { response_format: { type: "json_schema", json_schema: { name: "result", strict: true, schema: jsonSchema } } } : {}),
        ...(mode === "json_object" ? { response_format: { type: "json_object" } } : {}),
      });

      const systemFor = (mode) => (schema && mode !== "json_schema" ? `${system}\n\n${schemaInstructions(jsonSchema)}` : system);

      // 1) Find a structured-output mode the endpoint accepts.
      let response;
      let mode;
      let messages;
      for (; modeIndex < MODES.length; modeIndex++) {
        mode = MODES[modeIndex];
        messages = [
          { role: "system", content: systemFor(mode) },
          { role: "user", content: prompt },
        ];
        try {
          response = await call(buildBody(mode, messages));
          if (schema) modeMemory.set(memoryKey, mode);
          break;
        } catch (error) {
          if (!(error instanceof AppError && error.code === "AI_BAD_REQUEST") || modeIndex === MODES.length - 1) throw error;
        }
      }

      const read = (r) => {
        usage.inputTokens += r.usage?.prompt_tokens ?? 0;
        usage.outputTokens += r.usage?.completion_tokens ?? 0;
        const choice = r.choices?.[0];
        if (choice?.finish_reason === "length") throw new AppError("AI_OUTPUT_TRUNCATED", "The AI response was too long and was cut off.", 502);
        if (choice?.finish_reason === "content_filter") throw new AppError("AI_REFUSED", "The AI declined this request. Try rephrasing it.", 422);
        return choice?.message?.content ?? "";
      };

      let text = read(response);
      if (!schema) return { text, data: null, model: response.model ?? model, usage };

      // 2) Validate; one repair attempt with the validation errors.
      let data = extractJson(text);
      let check = schema.safeParse(data);
      if (!check.success) {
        const problem = data === undefined ? "Your reply was not valid JSON." : `Your JSON did not match the schema:\n${describeIssues(check.error)}`;
        const repair = await call(
          buildBody(mode, [...messages, { role: "assistant", content: text }, { role: "user", content: `${problem}\nReturn the complete corrected JSON object only.` }]),
        );
        text = read(repair);
        data = extractJson(text);
        check = schema.safeParse(data);
      }
      return { text, data: check.success ? check.data : data, model: response.model ?? model, usage };
  }
}
