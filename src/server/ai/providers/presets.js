/**
 * Free (or free-tier) text providers that speak the OpenAI-compatible
 * Chat Completions API. Choose one with AI_TEXT_PROVIDER; override the model
 * with AI_TEXT_MODEL and the endpoint with AI_BASE_URL.
 *
 * Model names change often — verify the default against the provider's model
 * list. Free tiers are rate-limited and have their own data-use terms.
 */
export const TEXT_PROVIDER_PRESETS = {
  gemini: {
    label: "Google Gemini (free tier via Google AI Studio)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    // "-latest" aliases follow Google's current free models; fallbacks are tried when a
    // model is retired, overloaded (503) or rate-limited (429). Verified 2026-11.
    defaultModel: "gemini-flash-latest",
    fallbackModels: ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3-flash-preview", "gemini-flash-lite-latest", "gemini-3.5-flash-lite"],
    keyEnv: "GEMINI_API_KEY",
    requiresKey: true,
  },
  groq: {
    label: "Groq (free tier)",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    keyEnv: "GROQ_API_KEY",
    requiresKey: true,
  },
  openrouter: {
    label: "OpenRouter (free models)",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    keyEnv: "OPENROUTER_API_KEY",
    requiresKey: true,
  },
  ollama: {
    label: "Ollama (free, runs on your own machine)",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.1:8b",
    keyEnv: null,
    requiresKey: false,
  },
  openai_compatible: {
    label: "Any OpenAI-compatible endpoint",
    baseUrl: null,
    defaultModel: null,
    keyEnv: "AI_API_KEY",
    requiresKey: false,
  },
};

export const OPENAI_COMPATIBLE_PROVIDERS = Object.keys(TEXT_PROVIDER_PRESETS);

/** Resolves endpoint, model and key for a provider from the environment (pure). */
export function resolvePreset(provider, env) {
  const preset = TEXT_PROVIDER_PRESETS[provider];
  if (!preset) return null;
  const baseUrl = (env.AI_BASE_URL || preset.baseUrl || "").replace(/\/+$/, "");
  const model = env.AI_TEXT_MODEL || preset.defaultModel;
  const fallbackModels = env.AI_TEXT_FALLBACK_MODELS
    ? env.AI_TEXT_FALLBACK_MODELS.split(",").map((m) => m.trim()).filter(Boolean)
    : env.AI_TEXT_MODEL
      ? []
      : (preset.fallbackModels ?? []);
  const apiKey = (preset.keyEnv && env[preset.keyEnv]) || env.AI_API_KEY || undefined;
  const missing = [];
  if (!baseUrl) missing.push("AI_BASE_URL");
  if (!model) missing.push("AI_TEXT_MODEL");
  if (preset.requiresKey && !apiKey) missing.push(preset.keyEnv);
  return { name: provider, label: preset.label, baseUrl, model, fallbackModels: fallbackModels.filter((m) => m !== model), apiKey, missing };
}
