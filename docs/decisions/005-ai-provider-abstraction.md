# ADR 005 — Provider-independent AI orchestration

**Decision.**
- Modules call only `generateText()` (`src/server/ai/orchestrator.js`); providers are
  resolved by a registry from `AI_TEXT_PROVIDER` / `AI_IMAGE_PROVIDER`.
- Text and image are separate capabilities with separate registries.
- Text adapter: Anthropic via the official `@anthropic-ai/sdk`, default model
  `claude-opus-5-5`, structured outputs via `output_config.format` + Zod, server-side refusal
  fallbacks enabled (`fallbacks: "default"`), refusals/truncation mapped to typed errors.
- Image provider: deliberately **not chosen yet** (Anthropic has no image generation). Selected in
  Phase 2 with a cost comparison; until then a clear `SERVICE_NOT_CONFIGURED` boundary.
- Every call is recorded (`ai_generations`) with tokens and estimated cost (`ai_usage_records`,
  micro-USD from `pricing.js`) and gated by workspace usage limits.
- Mock providers exist for tests only, flagged `isMock`, refused in production.
**Consequences.** Swapping/adding providers = one adapter + registry entry. Prices in
`pricing.js` must be maintained when models change. Model can be overridden per task
(e.g. a cheaper model for bulk tasks) — that choice is made per phase with approval.
**Status.** Proposed — needs approval of Anthropic as text provider and an API key.
