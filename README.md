# Brand AI

**Your Business. Your Brand. Your AI Marketing Team.**

An AI-powered business launch, branding, marketing, design and growth platform.
Users describe their business once; Brand AI reuses that **approved business
context** across every studio.

> **Status:** Phase 10 (SaaS administration & production launch) complete and awaiting approval.
> See [docs/PHASE_STATUS.md](docs/PHASE_STATUS.md).

## Available today
- Accounts, workspaces with roles, workspace data isolation.
- **Business Launch Studio** (`/launch`): idea → analysis, names, industry, audience, customer problems,
  competitors, business model, strategy, business plan, launch checklist — each editable, versioned and
  regenerable — then a structured **business profile** you approve for reuse across Brand AI.
- Business profile page for existing businesses (`/businesses/:id`).
- **Brand Identity Studio** (`/brand`): personality, voice, taglines, colour palettes (with contrast checks),
  typography, vector logos (4 layouts × 3 themes, editable, SVG/PNG download) and guidelines → an approved,
  versioned brand identity reused by every studio. Brand hub with asset library at `/businesses/:id/brand`.
- **Marketing Strategy Studio** (`/strategy`): personas, competitor analysis, channels, objectives, budget
  (computed totals + chart), advertising, KPIs and the full strategy → an approved, versioned marketing plan
  with Markdown/CSV exports and a printable view at `/businesses/:id/marketing`.
- **Social Media Studio** (`/social`): monthly plan → pillars and hashtag sets → content calendar → posts for
  Instagram, Facebook, TikTok and LinkedIn (captions, hashtags, carousels, stories, reel scripts, promotions),
  with platform checks, revision history and CSV/Markdown export.
- **Creative Design Studio** (`/design`): posters, flyers, ads, banners, product, event and social graphics —
  three AI options per brief drawn as vector art with your approved logo, colours and fonts; editable
  templates with live preview, versions, and SVG / PNG (300 dpi) / print-to-PDF export. "Design this post"
  links it to the Social Media Studio.
- **Website Builder** (`/websites`): business sites, landing pages, portfolios and online stores written from
  your profile (or started from a template), edited with a live desktop/phone preview, published at
  `/sites/:slug` or your own domain (DNS-verified), with working contact and order-enquiry forms.
- **Stationery & Merchandise** (`/stationery`): print-ready business cards (with bleed) and letterheads; T-shirts,
  uniforms, tote bags and mugs with mockups and real-size print artwork; product labels and packaging dielines;
  numbered invoices and quotations with totals calculated in code; and a printable company profile brochure.
- **Calendar & Automation** (`/automation`): one marketing calendar, a scheduling queue with approvals, email
  campaigns to a consent-based audience, reminders, preset automation rules and a full history — under three
  modes (draft only, approval required, authorized automation with limits). Channels: signed webhooks (Zapier,
  Make, n8n), Telegram and Facebook Pages. Set `CRON_SECRET` and call `POST /api/v1/cron/run` on a schedule.
- **Analytics & Insights** (`/analytics`): website traffic and conversions (cookieless page-view counting on
  published sites), email opens and clicks, publishing reliability, social engagement (results entered from each
  platform's insights), sales from paid invoices and quotes — each against the previous period — plus AI
  recommendations based only on those computed numbers, saved reports, CSV/Markdown export and a printable report.

**AI is free by default.** Brand AI uses Google Gemini's free tier (`AI_TEXT_PROVIDER=gemini`). Get a free
key at https://aistudio.google.com/apikey and set `GEMINI_API_KEY`. Other free options: Groq, OpenRouter free
models, or Ollama on your own machine (see `.env.example`). Recommended: add OpenRouter as a free fallback
(`OPENROUTER_API_KEY` + `AI_TEXT_FALLBACK_PROVIDERS="openrouter"`) so AI keeps working when Gemini's free quota
runs out — only `:free` OpenRouter models are ever used. Without a key the studios explain that AI is not
configured. To try the flows offline, set `AI_TEXT_PROVIDER=mock` and `AI_ALLOW_MOCK=true` — results are
clearly labelled sample data (refused in production).

## Stack
Next.js 16 (App Router, JavaScript) · React 19 · Tailwind CSS 4 · shadcn/ui
(Radix) · Lucide · MySQL 8 · Prisma 7 · Auth.js (NextAuth v4) · React Hook Form
+ Zod · Anthropic SDK (text AI) · S3-compatible storage · Vitest · Playwright.

## Quick start

Requirements: Node.js 22+, MySQL 8 (local install or `docker compose up -d mysql`).

```bash
npm install
cp .env.example .env              # then fill DATABASE_URL, SHADOW_DATABASE_URL, NEXTAUTH_SECRET
npm run db:migrate                # applies prisma/migrations and regenerates the Prisma client
npm run dev                       # http://localhost:3000
```

Create the databases (skip if you use `docker compose`, which runs `scripts/mysql-init.sql`):

```sql
CREATE DATABASE brandai_dev;  CREATE DATABASE brandai_shadow;  CREATE DATABASE brandai_test;
CREATE USER 'brandai'@'localhost' IDENTIFIED BY 'choose-a-password';
GRANT ALL PRIVILEGES ON brandai_dev.*    TO 'brandai'@'localhost';
GRANT ALL PRIVILEGES ON brandai_shadow.* TO 'brandai'@'localhost';
GRANT ALL PRIVILEGES ON brandai_test.*   TO 'brandai'@'localhost';
```

Generate a secret: `openssl rand -base64 32`.

## Tests

```bash
npm run lint
npm run test:unit                 # no database needed
cp .env.test.example .env.test    # TEST_DATABASE_URL must point at a *_test database
npm run test:integration          # real MySQL; truncates the test DB before each test
npm run build && npm run test:e2e # Playwright against a production build (creates users in DATABASE_URL)
npm run check                     # lint + unit + integration + build
```

## Environment variables
See [.env.example](.env.example) for the full list. Required to boot:
`DATABASE_URL`, `NEXTAUTH_SECRET` (required in production), `NEXTAUTH_URL`, `APP_URL`.
Optional integrations (features return `503 SERVICE_NOT_CONFIGURED` until set):
`GEMINI_API_KEY` (free; or another free provider), `S3_*` with `STORAGE_PROVIDER=s3`, `RESEND_API_KEY` with `EMAIL_PROVIDER=resend`.

In development, password-reset emails are printed to the server console
(`EMAIL_PROVIDER=console`); production refuses that setting.

## Project layout
```
prisma/                 schema.prisma, migrations/
src/app/                routes: (auth) pages, (app) authenticated pages, api/v1 route handlers
src/components/         ui/ (design system), layout/, auth/, brand/, theme/
src/modules/<studio>/   phase modules (Phase 1: launch/) — schemas, prompts, services, UI
src/components/structured/  schema-driven viewer/editor for structured AI output
src/server/             server-only shared services (auth, permissions, workspaces, businesses,
                        ai, storage, usage, audit, notifications, email, rate-limit, http, db, config)
src/validation/         Zod schemas shared by client and server
src/lib/                client-safe helpers (cn, api client, roadmap)
src/proxy.js            optimistic route protection (Next 16 "proxy")
tests/unit|integration  Vitest suites;  e2e/  Playwright suites
docs/                   roadmap, status, architecture, database, API, workflow, ADRs
```

## Documentation
[Roadmap](docs/PHASE_ROADMAP.md) · [Status](docs/PHASE_STATUS.md) ·
[Architecture](docs/SYSTEM_ARCHITECTURE.md) · [Database](docs/DATABASE_DESIGN.md) ·
[API](docs/API_DOCUMENTATION.md) · [Workflow](docs/DEVELOPMENT_WORKFLOW.md) ·
[Decisions](docs/decisions/README.md) · [Deployment](docs/DEPLOYMENT.md) · [Operations](docs/OPERATIONS.md) ·
[Security](docs/SECURITY.md) · [Performance](docs/PERFORMANCE.md)

## Deployment
See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): free start on Vercel + TiDB Cloud, or one server with
`docker compose` (app, MySQL, scheduler, daily backups). Operations: [docs/OPERATIONS.md](docs/OPERATIONS.md).
Production startup refuses mock AI providers and the console email provider.

## Known limitations
Phase-specific limitations are listed in [docs/PHASE_STATUS.md](docs/PHASE_STATUS.md).
- AI text uses free tiers (Gemini by default): rate-limited, quality varies by model, and each provider has its
  own data-use terms. Verified live on the Gemini free tier (both studios). If Google retires or overloads a
  model, the app falls back to the next one (`AI_TEXT_FALLBACK_MODELS`).
- Email needs Resend (free tier) in production; the console provider only logs messages.
  File storage works out of the box with the free `database` adapter (≤5 MB per file).
- Logos are typographic/icon compositions rendered as vectors; wordmarks support Latin scripts only.
- Sign-in is email + password (with optional two-factor); Google/OAuth sign-in isn't offered.
- Rate limiting and the scheduler use MySQL (ADR 013). Client IP relies on proxy headers.
- `npm audit` reports a high-severity ReDoS in `effect`, a dependency of the Prisma CLI config
  loader (build-time tool, no user input). The suggested fix is a Prisma downgrade; not applied.
- shadcn components were written by hand because the shadcn registry was unreachable from the
  build environment; the CLI works with the committed `components.json`.
