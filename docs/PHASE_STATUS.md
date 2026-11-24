# Phase Status

| Phase | Status | Approved |
|---|---|---|
| 0 — Foundation | APPROVED | ☑ |
| 1 — Business Launch Studio | APPROVED | ☑ |
| 2 — Brand Identity Studio | APPROVED | ☑ |
| 3 — Marketing Strategy Studio | APPROVED | ☑ |
| 4 — Social Media Studio | **COMPLETE — awaiting approval** | ☐ |
| 5 — Creative Design Studio | NOT STARTED (blocked on Phase 4 approval) | ☐ |
| 6–10 | NOT STARTED | ☐ |

**Current phase:** 4 (Social Media Studio) · **Last updated:** 2026-11-24

**Open follow-up (owner, 2026-11-24):** add Groq as a second free AI provider (cross-provider fallback) and
re-verify the remaining Phase 3 sections live.

---

## Phase 4 — Social Media Studio

Plan and acceptance criteria: [phases/PHASE_4.md](./phases/PHASE_4.md)

### Implemented and verified
- Monthly plan → social strategy (pillars, platform plans, hashtag sets) → content calendar (month grid /
  mobile agenda) → posts board (batch writing, filters, quick "Add a post" tool) → post editor (preview,
  computed checks, copy, status, rewrite, history/restore) → CSV/Markdown export.
- Calendar validated in code (month length, selected platforms, supported formats, promotions switch).
- Posts written in batches of up to 6 per AI call to conserve free-tier quota; missing items reported, never invented.
- Engine change: section post-processing receives the project (and edits now authorize before validating).

### Tests (all passing)
| Suite | Count |
|---|---|
| Unit | 97 (Phase 3: 89) |
| Integration (MySQL + provider simulator) | 84 (Phase 3: 76) |
| End-to-end (desktop + mobile) | 25 (Phase 3: 22) |
`npm run lint`, `npm run build` pass; all Phase 0–3 suites pass.

### Defects found and fixed
- React lint (setState inside effects) in the posts board/editor → fetches inlined with cancellation.
- Caption fields rendered as single-line inputs → prose fields always multi-line in the structured editor.

### Known limitations
- No publishing or scheduling to the platforms yet (Phase 8 adds integrations, approvals and automation).
- Platform limits are configured values (2026-11) and should be reviewed when platforms change them.
- Posts are text and direction only; images/designs come with Phase 5.
- Free AI capacity: see Phase 3 notes; batch writing reduces calls.

### Handover to Phase 5 (Creative Design Studio)
- Each post has `visualIdea`, `altText`, `format` and slide content — Phase 5 designs can be generated
  directly from posts ("design this post").
- Reuse the vector rendering approach from Phase 2 (structured specs → SVG) and approved brand
  colours/fonts/logo from `brand_identities`.

---

## Phase 3 — Marketing Strategy Studio (APPROVED)

Plan and acceptance criteria: [phases/PHASE_3.md](./phases/PHASE_3.md)

### Implemented and verified
- 8 AI sections (personas, competitor analysis, channels, objectives & campaigns, budget, advertising, KPIs,
  marketing strategy) on the shared studio engine; profile + brand context reused automatically.
- App-computed budget (totals, shares, first-year, over-budget warning), accessible bar chart + table.
- Versioned plan approval → `marketingPreferences` context; Markdown / CSV exports; printable plan.
- New shared helpers: `studioRoutes(engine)` route factory, `src/lib/markdown.js` (Markdown + safe CSV).
- Free-AI hardening found in live testing: 90 s per-model timeout, 200 s overall deadline, 10-minute
  cooldown for models that are overloaded, rate-limited or hung, one delayed second pass over models that
  were only overloaded, and a server log line per failed model attempt.

### Tests (all passing)
| Suite | Count |
|---|---|
| Unit | 89 (Phase 2: 81) |
| Integration (MySQL + provider simulator) | 76 (Phase 2: 65) |
| End-to-end (desktop + mobile) | 22 (Phase 2: 19) |
`npm run lint`, `npm run build` pass; all Phase 0–2 suites pass.

### Live verification (free Gemini tier, 2026-11-24)
- Succeeded with real AI: **personas** (gemini-3.5-flash, 35 s), **budget** (gemini-3.5-flash, 61 s),
  **objectives** (gemini-3.5-flash-lite, 32 s) — all schema-valid.
- The remaining five sections could not be verified live: for ~40 minutes every free Gemini model returned
  503 "high demand" or 429 "quota exceeded" (per-model free daily quotas were partly used by testing). The app
  handled it correctly — fallback through 6 models, cooldowns, second pass, then a clear
  "busy or unavailable, try again shortly" message instead of hanging.
- All eight sections are verified end to end with the mock provider (integration + e2e).
- Recommendation: add a second free provider (e.g. Groq) as a cross-provider fallback before real users.

### Defects found and fixed
- Budget tooltip only appeared for keyboard focus → shows on any focus/hover.
- Phasing amounts displayed unformatted → formatted in the plan currency.
- Free models could hang for minutes without falling back → per-attempt timeout + cooldown.
- Vitest warned about duplicate React plugins → projects inherit the root config.

### Known limitations
- Free tiers have small daily quotas per model; after heavy use some models return 429 until the quota resets
  and the app falls back to other free models (slower). Heavy production use will need a paid tier or more providers.
- Competitor analysis uses model knowledge only (labelled; verify before relying on it).
- No ad-platform or analytics connections yet (Phases 8–9).

### Handover to Phase 4 (Social Media Studio)
- AI already receives `marketingPreferences` (channels, personas, objectives, core message, pillars) with the
  profile and brand context — Phase 4 content should be generated from these, not re-asked.
- Use `createStudioEngine` + `studioRoutes` + `StudioShell`/`SectionPanel`.

---

## Phase 2 — Brand Identity Studio (APPROVED)

Plan and acceptance criteria: [phases/PHASE_2.md](./phases/PHASE_2.md). Free-only approach approved by the owner.

### Implemented and verified
- Seven AI sections: personality, voice, taglines, colour palettes, typography, logo concepts, guidelines —
  versioned, editable, regenerable, acceptable; "pick one" selections for taglines/palettes/typography/logos.
- **Vector logo system** (no image model, no extra cost): AI-designed structured specs rendered server-side
  to SVG with text converted to outlines (15 bundled OFL fonts, 143 curated ISC-licensed Lucide icons,
  7 shapes); 4 layouts × 3 themes; logo editor with live preview; SVG + PNG downloads.
- Computed WCAG contrast ratings for every palette.
- Self-hosted font serving for typography previews (no third-party font requests).
- Versioned brand identity approval (admin/owner) → `brandIdentity` + `brandVoice` context sections;
  profile saves now carry studio-owned sections forward.
- Brand hub, brand asset library, printable guidelines.
- New free `database` storage adapter (MySQL, ≤5 MB per file) — now the default `STORAGE_PROVIDER`;
  authenticated file serving route for all adapters.
- Refactor: Launch Studio and Brand Studio now share one studio engine (`src/server/studio/engine.js`)
  and shared UI (`src/components/studio/*`). Phase 1 regression suites pass unchanged.
- Prisma client is now created lazily (imports no longer need `DATABASE_URL`).

### Tests (all passing)
| Suite | Count |
|---|---|
| Unit | 76 (Phase 1: 58) |
| Integration (MySQL) | 57 (Phase 1: 45) |
| End-to-end (desktop + mobile) | 19 (Phase 1: 16) |
`npm run lint`, `npm run build` pass.

### Defects found and fixed during Phase 2
- opentype.js 2.0 crashed shaping some fonts and corrupted combined-path serialization → glyphs are laid
  out and serialized by our own code.
- `npm run db:migrate -- --name x` passed `--name` to `prisma generate` and hung → generate moved to a `postdb:migrate` hook.
- Logo tiles overflowed for stacked/mark variants → absolute-fit images.
- `opentype.js` default import failed under Turbopack → named import.

### Change after Phase 2 delivery — free AI providers (owner request)
- Default AI text provider switched from Anthropic (paid) to **Google Gemini free tier** via a new
  OpenAI-compatible adapter that also supports Groq, OpenRouter free models, Ollama and any compatible
  endpoint (ADR 010). Strict JSON-schema output with automatic fallback and one repair attempt.
- Automatic model fallback: Google retires free models for new users and returns 503 under high demand,
  so the Gemini preset uses the `gemini-flash-latest` alias plus a fallback chain
  (`AI_TEXT_FALLBACK_MODELS`); 404/503/429 move to the next model.
- Renderer fix found during live testing: name-only (wordmark) logo concepts no longer get a stray
  initial in horizontal/stacked layouts.
- Tests: 81 unit · 65 integration · 19 e2e — all passing.
- **Live verification (free Gemini tier, 2026-11-24): 10/10 real generations succeeded** — Launch
  (idea analysis, names, industry) and Brand (personality, voice, taglines, palettes, typography, logo
  concepts, guidelines) followed by identity approval. All AI outputs passed schema validation; logo specs
  used only valid fonts/icons/colours. Served by `gemini-3.5-flash` via fallback; ~17 s average per
  section; ~15k tokens; $0.

### Known limitations
- Free-tier capacity varies minute to minute (503 "high demand"); the fallback chain absorbs this, but
  if every model is busy users see "busy or unavailable, try again shortly".
- Logos are typographic/icon-based compositions, not illustrations. Illustrative imagery would need an
  image model (a free option such as Pollinations or Hugging Face can be added behind the existing image-provider boundary).
- Wordmarks support Latin scripts only (bundled font subsets); unsupported characters fall back to Inter and the UI shows a warning.
- Database storage is intended for small brand files (≤5 MB each); switch to S3-compatible storage (free tiers:
  Supabase Storage, Backblaze B2) as usage grows — no code changes needed.
- PDF guidelines use the browser's print dialog.
- Streaming pages return HTTP 200 with the 404 UI for other workspaces' resources (APIs return real 404s).

### Handover to Phase 3 (Marketing Strategy Studio)
- Create the studio with `createStudioEngine` (`ProjectType.STRATEGY_STUDIO`), shared `StudioShell`/`SectionPanel`.
- The AI already receives approved `basics/offering/audience/goals/competitors/brandIdentity/brandVoice` context.
- Phase 3 adds `marketingPreferences` to context via `publishApprovedSections`.

---

## Phase 1 — Business Launch Studio (APPROVED)

Plan and acceptance criteria: [phases/PHASE_1.md](./phases/PHASE_1.md)

### Implemented and verified
- Idea input (new or existing business) → business + launch project in the active workspace.
- 10 AI sections with structured output: idea analysis (viability score), business names, industry
  classification, target audience, customer problems, competitor research, business model, strategy,
  business plan, launch checklist. Each feeds the relevant earlier results (accepted version first) and
  the approved business context into the prompt.
- Every generation and every user edit is an immutable version; versions can be viewed and accepted;
  regenerate accepts revision instructions. Edits are validated server-side against the section schema.
- "Use this name" sets the business name from a suggestion.
- Launch checklist with persisted progress.
- Business profile builder (pre-filled from outputs) writing structured tables; saving creates a central
  context draft; admins/owners approve which sections AI may reuse.
- Business profile page for any business (individual-tool path, no guided journey required).
- Markdown export of the launch pack.
- Sidebar, dashboard and launch list wired; studio unlocked in the roadmap.
- Generic, reusable building blocks for later studios: `projects`/`project_outputs`, schema-driven
  `StructuredView` / `StructuredEditor`, mock-fixture registry for tests.

### Tests (all passing)
| Suite | Count |
|---|---|
| Unit (Vitest) | 58 (Phase 0: 38) |
| Integration (Vitest + MySQL) | 45 (Phase 0: 28) |
| End-to-end (Playwright, desktop + mobile) | 16 (Phase 0: 13) |
`npm run lint` and `npm run build` pass. Phase 0 regression suites pass unchanged.

### Defects found and fixed during Phase 1
- Optional text fields kept empty strings instead of `undefined` (schema union order) — fixed in launch and profile schemas.
- Idea form could not submit when the workspace had no businesses (hidden `businessId: ""` failed UUID validation) — fixed.
- Studio jumped to the next section after generating — default step is now fixed at load.
- Prisma 7 `migrate dev` no longer runs `generate` — `npm run db:migrate` now runs both.

### Known limitations
- **Real AI not verified in this environment**: no Anthropic API key was available, so every AI path was
  verified with the test-only mock provider (labelled "Test mode" / "Sample data" in the UI). The
  Anthropic adapter itself is unchanged from Phase 0 and has not yet made a live call.
- Competitor research uses model knowledge only (no live web search) and says so in its output.
- Generation is synchronous (the business plan can take ~1–2 minutes); background jobs arrive in Phase 8.
  On Vercel the generate route needs a plan that allows `maxDuration = 300`.
- For pages that stream (Cache Components), "not found" for another workspace's project renders the
  404 UI but the HTTP status is 200 (the status is sent before the access check). APIs return real 404s.
- Export is Markdown only (PDF/DOCX later).
- Saving a profile replaces its lists (row ids change); fine for now, revisit if other tables reference them.

### Handover to Phase 2 (Brand Identity Studio)
- Reuse `projects`/`project_outputs` (add `ProjectType.BRAND_STUDIO`), `StructuredView`/`StructuredEditor`,
  section/fixture pattern from `src/modules/launch`.
- Phase 2 fills context sections `brandIdentity` and `brandVoice`; brand assets use `stored_files`.
- Decisions needed before Phase 2: image-generation provider (paid) and storage provider + credentials.

---

## Phase 0 — Foundation (APPROVED)

### Implemented and verified
- Next.js 16 (App Router, JavaScript only), Tailwind CSS 4, shadcn/ui-format components (Radix), Lucide icons.
- Design system: tokens for light/dark, Fraunces + Manrope type, cards, buttons, forms, alerts, empty/error/loading states, responsive app shell with mobile drawer.
- MySQL 8 + Prisma 7 schema and first migration (`init_foundation`) — 13 tables.
- Authentication (Auth.js v4 credentials): registration, login, logout, password recovery (hashed single-use tokens, 30-min TTL), JWT sessions re-validated against the DB on every request, session revocation on password reset, account lockout, rate-limited login/registration/recovery.
- Workspaces: personal workspace on sign-up, memberships with roles (OWNER/ADMIN/EDITOR/VIEWER), permission map, active-workspace switching.
- Workspace isolation: every service resolves an authorized workspace scope first; cross-tenant ids return 404.
- Businesses: CRUD service + API with soft delete (foundation for Phase 1).
- Central business context: versioned drafts → approval of selected sections → AI receives approved sections only.
- AI orchestrator (provider-independent): authorization, rate limit, usage limits, context injection, structured output validation, generation records, token/cost tracking, audit. Anthropic text adapter (official SDK). Image generation boundary (no provider yet).
- Storage abstraction: S3-compatible adapter, magic-byte upload validation, workspace-prefixed keys, signed download URLs, storage quota.
- Shared services: validation (Zod), permissions, audit log, notifications (in-app), email (console/Resend), rate limiting (DB store), structured logger, standard API envelope, CSRF origin check, security headers.
- Tests: 38 unit, 28 integration (real MySQL), 13 end-to-end (Playwright, desktop + mobile). All passing.
- `npm run build` and `npm run lint` pass.

### Not connected (credentials not provided — integration boundary only)
- Anthropic API key → AI calls return `503 SERVICE_NOT_CONFIGURED`.
- Image generation provider → `503 SERVICE_NOT_CONFIGURED` until chosen in Phase 2.
- S3-compatible storage → uploads return `503 SERVICE_NOT_CONFIGURED`.
- Resend email → development logs reset emails to the server console; production refuses `console`.

### Known limitations / open issues
See "Known limitations" in [../README.md](../README.md#known-limitations).

### Handover to Phase 1
- Reuse: `generateText()` (src/server/ai/orchestrator.js), business + context services, `route()` wrapper, `requireWorkspaceAccess()`, design-system components.
- Phase 1 must add: business sub-tables (products, services, locations, audiences, competitors, goals), `projects` if needed, launch-studio module, UI wizard, and fill context sections `basics`, `offering`, `audience`, `goals`, `competitors`.
- Decide before Phase 1 AI work: confirm Anthropic as text provider and supply `ANTHROPIC_API_KEY` for the target environment.
