# ADR 010 — Free AI text providers by default

**Context.** The owner asked for free services only; the Anthropic API is paid. All AI features must keep
working through the provider-independent orchestrator (ADR 005).

**Options.** Google Gemini free tier · Groq free tier · OpenRouter free models · Ollama (local, fully free)
· Cloudflare Workers AI / Hugging Face free tiers.

**Decision.**
- One adapter for the **OpenAI-compatible Chat Completions API** (`src/server/ai/providers/openai-compatible.js`,
  plain `fetch`), with presets in `presets.js`: `gemini` (default), `groq`, `openrouter`, `ollama`,
  `openai_compatible`. Anthropic stays available as a paid option.
- Structured output: strict `json_schema` → `json_object` + schema in the prompt → prompt only, downgraded
  automatically on HTTP 400 and remembered per endpoint/model. Responses are parsed (fences/prose tolerated),
  validated with the section's Zod schema, and repaired once by sending the validation errors back.
- Free-tier rate limits (HTTP 429) surface as a clear "wait a minute" error; workspace request limits still
  protect quotas. Cost is recorded as $0 (tokens are still tracked).

**Consequences.**
+ No paid AI dependency; switching provider is configuration only.
− Free models are less consistent than frontier models; the repair step and schema validation contain this,
  but output quality varies by model.
− Free tiers have their own data-use terms (some may use prompts to improve their products) and change
  limits/model names over time. Review terms before production and keep `AI_TEXT_MODEL` current.
− Ollama is free and private but needs your own machine/server; it cannot run on Vercel.
