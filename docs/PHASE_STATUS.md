# Phase Status

| Phase | Status | Approved |
|---|---|---|
| 0 — Foundation | APPROVED | ☑ |
| 1 — Business Launch Studio | APPROVED | ☑ |
| 2 — Brand Identity Studio | APPROVED | ☑ |
| 3 — Marketing Strategy Studio | APPROVED | ☑ |
| 4 — Social Media Studio | APPROVED | ☑ |
| 5 — Creative Design Studio | APPROVED | ☑ |
| 6 — Website Builder | APPROVED | ☑ |
| 7 — Stationery & Merchandise | **COMPLETE — awaiting approval** | ☐ |
| 8–10 | NOT STARTED | ☐ |

**Current phase:** 7 (Stationery & Merchandise) · **Last updated:** 2026-11-24

**Second free AI provider — done (2026-11-24, ADR 011):** OpenRouter free models are configured as a fallback
(`AI_TEXT_FALLBACK_PROVIDERS=openrouter`); verified live (Gemini failed → OpenRouter answered a design request
in 46 s). OpenRouter is restricted to `:free` models so the key's credit is never spent. Groq can be added the
same way later (`openrouter,groq`).

---

## Phase 7 — Stationery & Merchandise

Plan and acceptance criteria: [phases/PHASE_7.md](./phases/PHASE_7.md)

### Implemented and verified
- `/stationery` hub; branded materials (cards, letterheads, T-shirts, polos, totes, mugs, labels, packaging) with
  live preview, versions and print-ready SVG/PNG/PDF exports; `/stationery/details` business details;
  invoices & quotations with code-computed totals, numbering, statuses, quote → invoice and printable A4 pages
  (`/print/documents/:id`); company profile studio with printable brochure (`/print/profiles/:id`).
- New shared pieces: `src/server/stationery/{draw,renderer}.js` (vector drawing at physical size),
  `src/modules/stationery/money.js` (BigInt money maths), `src/components/print/print-toolbar.jsx`.

### Tests (all passing)
| Suite | Count |
|---|---|
| Unit | 146 (Phase 6: 132) |
| Integration (MySQL + mock provider) | 107 (Phase 6: 99) |
| End-to-end (desktop + mobile) | 35 (Phase 6: 31) |
`npm run lint`, `npm run build` pass; all Phase 0–6 suites pass.

### Live verification (2026-11-24, free AI)
- T-shirt concepts written by Gemini `gemini-flash-lite-latest` (93 s incl. retries) and rendered; company profile
  overview by Gemini in 1.4 s — specific, on-brand and without invented facts.
- Found and fixed: business names without an approved logo were truncated on merch ("Kirkga te…") → sizing now
  uses both box dimensions (regression test); light inks were invisible in the transparent artwork preview →
  artwork previews on the product colour.

### Defects found and fixed during the phase
- Company profile cover lost its brand background (conflicting classes) → explicit cover tone.
- Brochure `<style>` with two text children caused a hydration error → single string.
- New invoices could keep a 0 % tax rate if typed before defaults loaded → defaults apply until a rate is edited.

### Known limitations
- Documents are sent by printing/saving as PDF and attaching; emailing, payment links and reminders need the
  Phase 8 approval workflow and integrations.
- Label legal content (allergens, nutrition) is the owner's responsibility; the app prints only what is entered.
- Mockups are stylised vector illustrations, not photographic renders; print files are what printers use.
- Fonts are Latin-only; PDF via the browser's print dialog.

### Handover to Phase 8 (Calendar & Automation)
- Invoice/quote status changes are audited and ready for approval rules and reminders (overdue flag computed).
- Social posts, designs, websites and documents all carry statuses/versions for scheduling and approvals.

---

## Phase 6 — Website Builder (APPROVED)

Plan and acceptance criteria: [phases/PHASE_6.md](./phases/PHASE_6.md)

### Implemented and verified
- `/websites` list, `/websites/new` (type, style, brief; AI or template), `/websites/:id` editor (content with
  live desktop/phone preview, settings, publish & domain, messages), public sites at `/sites/:slug[/:page]` and
  on verified custom domains (proxy host rewrite).
- Structured site configs rendered by controlled components only; per-section AI rewrite; versioned publishing;
  contact/order forms with inbox + notifications; DNS-verified custom domains; new `website:publish` permission.
- Shared helpers moved to `src/server`: `brand/approved-brand.js` (approved brand + vector logo) and
  `storage/business-images.js` (business image assets), now used by Design and Website studios.

### Tests (all passing)
| Suite | Count |
|---|---|
| Unit | 132 (Phase 5: 111, + AI fallback tests) |
| Integration (MySQL + mock provider) | 99 (Phase 5: 91) |
| End-to-end (desktop + mobile) | 31 (Phase 5: 28) |
`npm run lint`, `npm run build` pass; all Phase 0–5 suites pass.

### Live verification (2026-11-24, free AI)
- A complete business website was written by real AI: Gemini's free models were busy (503/429), the new
  fallback switched to OpenRouter `nvidia/nemotron-3-ultra-550b-a55b:free`, which wrote all four pages in 89 s.
  Published and viewed on desktop and phone.
- Findings fixed: navigation used the AI's long SEO-style page title (now standard page names, AI wording goes
  to SEO); the model added unconfirmed specifics (durations, group sizes, opening days) despite instructions —
  prompt tightened and a "check the facts before you publish" notice added for unpublished AI sites.

### Defects found and fixed during the phase
- Public site read the clock and DB during prerender (Cache Components) → `connection()` + publish-year prop.
- Product order links, page links and anchors verified for both `/sites/:slug` and custom-domain bases.
- e2e isolation: tests no longer depend on fixed slugs/domains in the shared database.

### Known limitations
- Unknown public pages show the not-found page with `noindex` but HTTP 200: with Cache Components the response
  starts streaming before the request-time lookup (documented Next.js behaviour). A true 404 would need a DB
  lookup in the proxy.
- HTTPS for custom domains is issued by the hosting platform (e.g. Vercel domains, Caddy on-demand TLS); Brand AI
  verifies ownership and routes the host. Wildcard subdomains (`slug.yourbrand.site`) are not set up.
- No card payments, carts or stock (payment providers are paid services; Phase 10). Orders are enquiries.
- No visitor analytics yet (Phase 9). Forms are rate-limited; a returned JSON 429 is shown to bots/spammers.
- Fixed section components (no freehand layout); bundled fonts are Latin-only.

### Handover to Phase 7 (Stationery & Merchandise)
- Reuse `resolveBrand`/`resolveSiteBrand`, the design renderer and text helpers for business cards, letterheads
  and labels; contact details live in each website's config today — Phase 7 may promote them to the profile.

---

## Phase 5 — Creative Design Studio (APPROVED)

Plan and acceptance criteria: [phases/PHASE_5.md](./phases/PHASE_5.md)

### Implemented and verified
- `/design` gallery, `/design/new` brief → 3 rendered options → save, `/design/:id` editor with live preview,
  versions/restore, duplicate, delete, SVG / PNG (300 dpi print) / print-to-PDF exports.
- Vector design renderer `src/server/design/renderer.js` (6 templates + wide-banner layout) using the approved
  brand identity; shared text layout helpers extracted to `src/server/brand/text.js` (measure, wrap, fit, blocks).
- "Design this post" button in the Social Media Studio post editor (pre-fills brief, size and CTA).
- Photos from the business's brand assets (same business only), placed in the split-image layout.

### Tests (all passing)
| Suite | Count |
|---|---|
| Unit | 111 (Phase 4: 97) |
| Integration (MySQL + mock provider) | 91 (Phase 4: 84) |
| End-to-end (desktop + mobile) | 28 (Phase 4: 25) |
`npm run lint`, `npm run build` pass; all Phase 0–4 suites pass.

### Live verification
- Rendering, editing and exports are deterministic code and were verified visually (contact sheets of every
  template × format, light/dark UI, 390 px).
- AI option generation uses the same orchestrator and free Gemini provider as earlier phases; verified with
  the mock provider. Live attempt (2026-11-24 17:16 UTC): every free Gemini model returned 503 "high demand"
  or quota errors; the app showed "The AI model is busy… try again shortly" after 13 s and saved nothing.
  Fixed by the OpenRouter fallback: a live design request then succeeded (see ADR 011). That live run also found
  typographic characters (non-breaking hyphens) missing from fonts → now normalized before drawing.

### Defects found and fixed during the phase
- Words were split mid-word when a headline was too long → fitting now shrinks before breaking words.
- Long content overlapped footers → items are measured, sized to fit, and optional ones hidden with a warning.
- A provided photo could be ignored when no option chose the photo layout → at least one option shows it.
- Mid-grey brand colours produced 4.48:1 text → contrast fallback now guarantees ≥ 4.5:1.
- Rapid edits could export a stale preview → exports are enabled only when the preview matches the edits.

### Known limitations
- No AI-generated imagery (no free, reliable image API; adding one needs approval as a paid service). Photos
  come from uploads.
- Fixed templates rather than freehand positioning; bundled fonts are Latin-only (others fall back to Inter).
- PDF is via the browser's print dialog ("Save as PDF"), not a server-generated PDF.

### Handover to Phase 6 (Website Builder)
- The renderer's brand resolution (`resolveBrand`) and text helpers can produce hero/OG images for websites.
- Website sections should reuse approved context + brand identity the same way.

---

## Phase 4 — Social Media Studio (APPROVED)

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

### Live verification (free Gemini tier, 2026-11-24)
- **Content calendar generated successfully with real AI** (gemini-flash-lite-latest, 11 s); 8 posts created from it.
- Social strategy and the 4-post batch could not complete: Google's free tier returned 429 (daily quota
  exhausted) on the main models and 503/timeouts on the lite models. The app reported "busy, try again"
  and left the posts as ideas — nothing invented. All flows are verified with the mock provider.
- This reinforces the open follow-up: add Groq as a second free provider.

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
