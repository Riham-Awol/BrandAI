# ADR 011 — Cross-provider fallback between free AI providers

**Context.** The free Gemini tier is regularly exhausted (429) or overloaded (503) during the day, so AI
features failed even with model-level fallbacks (ADR 010). The owner supplied an OpenRouter key; it carries
paid credit, but the owner wants free services only.

**Options.** Retry Gemini longer · switch the primary provider · chain providers.

**Decision.**
- `AI_TEXT_FALLBACK_PROVIDERS` (comma list, e.g. `openrouter,groq`) adds providers tried after the primary
  (`src/server/ai/providers/fallback.js`). They are tried on capacity, timeout, credential and network errors —
  not on invalid output. The primary gets half the 230 s budget, later providers the rest (routes allow 300 s).
- Model/endpoint overrides (`AI_TEXT_MODEL`, `AI_TEXT_FALLBACK_MODELS`, `AI_BASE_URL`, `AI_API_KEY`) apply to the
  primary only; fallbacks use their presets and their own key variable.
- **OpenRouter is free-only:** only model ids ending in `:free` are ever called; a paid model configured
  explicitly makes the provider "not configured" instead of spending credit.
- Usage records store the provider and model that actually answered.

**Consequences.**
+ Verified live 2026-11-24: Gemini failed → OpenRouter (`nvidia/nemotron-3-ultra-550b-a55b:free`) answered.
+ No spend possible on OpenRouter. − Free model lists change; presets need occasional review.
− Different models write in slightly different styles; output is still schema-validated.
