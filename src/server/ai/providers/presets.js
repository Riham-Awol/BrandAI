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
    // Free models verified 2026-11-24 (JSON output, 1.5–25 s). The list changes often:
    // https://openrouter.ai/models?max_price=0
    defaultModel: "nvidia/nemotron-3-ultra-550b-a55b:free",
    fallbackModels: ["inclusionai/ling-3.2-flash:free", "baidu/ernie-5.5-flash-preview:free", "nvidia/nemotron-3.5-super-vl:free", "google/gemma-4-31b-it:free"],
    keyEnv: "OPENROUTER_API_KEY",
    requiresKey: true,
    // OpenRouter keys can carry paid credit: only ":free" models are ever called.
    freeOnly: true,
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
const isFree = (m) => m.endsWith(":free");

/**
 * Resolves endpoint, model and key for a provider from the environment (pure).
 * The AI_TEXT_MODEL / AI_TEXT_FALLBACK_MODELS / AI_BASE_URL / AI_API_KEY overrides apply
 * to the primary provider only; fallback providers (AI_TEXT_FALLBACK_PROVIDERS) use their presets.
 */
export function resolvePreset(provider, env, { primary = true } = {}) {
  const preset = TEXT_PROVIDER_PRESETS[provider];
  if (!preset) return null;
  const o = primary ? env : {};
  const baseUrl = (o.AI_BASE_URL || preset.baseUrl || "").replace(/\/+$/, "");
  let model = o.AI_TEXT_MODEL || preset.defaultModel;
  let fallbackModels = o.AI_TEXT_FALLBACK_MODELS
    ? o.AI_TEXT_FALLBACK_MODELS.split(",").map((m) => m.trim()).filter(Boolean)
    : o.AI_TEXT_MODEL
      ? []
      : (preset.fallbackModels ?? []);
  const missing = [];
  let paidRejected = false;
  if (preset.freeOnly) {
    fallbackModels = fallbackModels.filter(isFree);
    if (model && !isFree(model)) {
      paidRejected = true;
      model = null;
    }
  }
  const apiKey = (preset.keyEnv && env[preset.keyEnv]) || o.AI_API_KEY || undefined;
  if (!baseUrl) missing.push("AI_BASE_URL");
  if (paidRejected) missing.push(`a free model id ending in ":free" for ${provider} (paid models are disabled)`);
  else if (!model) missing.push("AI_TEXT_MODEL");
  if (preset.requiresKey && !apiKey) missing.push(preset.keyEnv);
  return { name: provider, label: preset.label, baseUrl, model, fallbackModels: fallbackModels.filter((m) => m !== model), apiKey, missing };
}

/** Parses AI_TEXT_FALLBACK_PROVIDERS (comma list of OpenAI-compatible presets, excluding the primary). */
export function parseFallbackProviders(value, primary) {
  return [...new Set(String(value ?? "").split(",").map((s) => s.trim()).filter(Boolean))].filter((p) => p !== primary && OPENAI_COMPATIBLE_PROVIDERS.includes(p));
}
