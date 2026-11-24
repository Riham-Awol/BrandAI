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

**Update (live verification).** Google retired `gemini-2.5-flash` for new keys and free models return 503
under load. The Gemini preset now defaults to the `gemini-flash-latest` alias with a fallback chain; the
adapter moves to the next model on 404/503/429. Verified live: 10/10 generations across both studios.
Note for sandboxed environments: Node's built-in fetch only uses an HTTPS proxy when `NODE_USE_ENV_PROXY=1`.

**Update (Phase 3 live testing).** Free models can also hang for minutes and exhaust small per-model daily
quotas (429). The adapter now abandons an attempt after 90 s, stops starting new attempts after 200 s, and puts
models that timed out, were overloaded or rate-limited on a 10-minute cooldown (tried last). If every model
was merely overloaded (503), it waits 5 s and makes one more pass over those models. Each failed attempt is logged.
