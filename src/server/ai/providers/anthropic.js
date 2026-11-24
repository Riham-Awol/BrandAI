import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AppError, Errors } from "../../errors.js";

// Models that accept the server-side refusal fallback chain.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5", "claude-opus-5", "claude-fable-5-2", "claude-fable-5-1"]);

/**
 * Anthropic text provider (official SDK). Structured output uses
 * output_config.format with a Zod schema; the SDK validates the response.
 */
export function createAnthropicTextProvider({ apiKey, defaultModel }) {
  if (!apiKey) {
    return {
      name: "anthropic",
      configured: false,
      async generate() {
        throw Errors.notConfigured("AI text generation (ANTHROPIC_API_KEY missing)");
      },
    };
  }

  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });

  return {
    name: "anthropic",
    configured: true,
    async generate({ system, prompt, schema, model = defaultModel, maxTokens = 16000, effort = "medium" }) {
      const params = {
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
        output_config: { effort, ...(schema ? { format: betaZodOutputFormat(schema) } : {}) },
      };
      if (FALLBACK_MODELS.has(model)) {
        params.betas = ["server-side-fallback-2026-07-01"];
        params.fallbacks = "default";
      }

      let response;
      try {
        response = schema ? await client.beta.messages.parse(params) : await client.beta.messages.create(params);
      } catch (error) {
        throw mapAnthropicError(error);
      }

      if (response.stop_reason === "refusal") {
        throw new AppError("AI_REFUSED", "The AI declined this request. Try rephrasing it.", 422, {
          category: response.stop_details?.category ?? null,
        });
      }
      if (response.stop_reason === "max_tokens") {
        throw new AppError("AI_OUTPUT_TRUNCATED", "The AI response was too long and was cut off.", 502);
      }

      const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      const usage = {
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
        cacheWriteTokens: response.usage?.cache_creation_input_tokens ?? 0,
        cacheReadTokens: response.usage?.cache_read_input_tokens ?? 0,
      };
      return { text, data: schema ? (response.parsed_output ?? null) : null, model: response.model ?? model, usage, raw: { id: response.id } };
    },
  };
}

function mapAnthropicError(error) {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AppError("AI_PROVIDER_AUTH", "The AI provider rejected the server credentials.", 503);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AppError("AI_PROVIDER_BUSY", "The AI provider is busy. Please try again shortly.", 503);
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new AppError("AI_BAD_REQUEST", "The AI request was rejected.", 502, { providerMessage: error.message?.slice(0, 300) });
  }
  if (error instanceof Anthropic.APIError) {
    return Errors.upstream("The AI provider returned an error.");
  }
  return error;
}
