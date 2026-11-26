# ADR 017 — Learning from approvals instead of training a model; Cloudflare Workers AI as a free provider

**Context.** The owner asked for an AI that "learns" without paid services. Training or fine-tuning a model needs
GPUs, large datasets and paid hosting; the app already uses free hosted models.

**Decision.**
- **Learning from approvals (few-shot memory).** Accepting a studio section (any `createStudioEngine` studio)
  or marking a social post "ready" saves the content in `ai_examples` (one per source, newest 20 per business and
  task). The orchestrator adds up to 3 recent examples for the same business + module + task to the prompt as
  `<approved_examples>`, described as style references (no copying, no new facts). Mock outputs are never saved.
  Each generation records which examples it used. Workspaces can switch learning off (admins/owner) and view or
  delete examples (Settings → AI memory).
- **Cloudflare Workers AI** joins the free providers (`cloudflare` preset: OpenAI-compatible endpoint with the
  account id in the URL, `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN`), usable as primary or fallback.

**Consequences.** Costs nothing, works with every provider, improves with use and stays inside the workspace.
Prompts grow by up to ~4,500 characters when examples exist. The approved examples are also the dataset for a
possible future fine-tune of an open model.
