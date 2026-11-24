# System Architecture

Brand AI is a **modular monolith**: one Next.js application (App Router,
JavaScript) deployed to Vercel, one MySQL 8 database, and pluggable external
providers behind server-side abstractions.

```
Browser ──► Next.js (Vercel)
             ├─ src/proxy.js           optimistic redirect if no session cookie
             ├─ src/app/(auth)/*       login, register, password recovery (client forms)
             ├─ src/app/(app)/*        authenticated pages (Server Components)
             ├─ src/app/api/v1/*       JSON API (route handlers, thin)
             │      └─ route() wrapper: origin check → auth → rate limit → handler → error envelope
             └─ src/server/*           shared services (server-only)
                    ├─ auth/            Auth.js options, session DAL, password, tokens
                    ├─ permissions/     roles → permissions, requireWorkspaceAccess()
                    ├─ workspaces/      workspace + membership services
                    ├─ businesses/      business CRUD, central business context (versioned)
                    ├─ ai/              orchestrator, provider registry, adapters, pricing
                    ├─ storage/         storage adapters, upload validation, files service
                    ├─ usage/           limits + usage measurement
                    ├─ audit/ notifications/ email/ rate-limit/ config/ http/ db/
                    └─ actions/         server actions (UI mutations)
                         │
                         ├─► MySQL 8 (Prisma 7 + MariaDB driver adapter)
                         ├─► AI text: Gemini free tier (default) / Groq / OpenRouter / Ollama / Anthropic [server only]
                         ├─► S3-compatible storage         [server only]
                         └─► Resend (email)                [server only]
```

## Layering rules
1. **UI components** never query the database or check permissions. Server
   Components call services; Client Components call the API or server actions.
2. **Route handlers / server actions** are thin: parse with Zod (`parseWith`),
   call one service, return `ok()`.
3. **Services** own business logic. Every tenant-scoped service starts with
   `requireWorkspaceAccess(user, workspaceId, PERMISSION)` and constrains all
   queries by the returned `scope.workspaceId`.
4. **Providers** (AI, storage, email) are reached only through their
   registries, so a provider change is a configuration + adapter change.
5. Phase modules will live in `src/modules/<key>/` (UI components, prompts,
   schemas, module services) and depend on `src/server/*`, never the reverse.

## Studio modules (Phase 1+)
```
src/modules/launch/
  schemas.js        Zod input + per-section output schemas (client + server)
  sections.js       ordered section metadata and dependencies (client-safe)
  prompts.js        instructions and prompt assembly (server-only)
  service.js        projects, versioned generation, edits, accept, checklist, export
  profile-draft.js  pre-fills the business profile from outputs
  markdown.js       launch-pack export (pure)
  mock-fixtures.js  sample outputs for the TEST-ONLY mock provider
  components/       idea form, studio, checklist, profile step
```
Shared building blocks introduced for all studios:
- `projects` + `project_outputs`: append-only versioned section outputs (AI or user edit), one accepted per section.
- `src/components/structured/*`: `schemaToSpec()` turns an output Zod schema into a field spec that
  drives a generic, readable `StructuredView` and a validated `StructuredEditor`.
- `src/server/businesses/profile-service.js`: structured profile tables ↔ central context draft.
- Mock fixture registry (`src/server/ai/providers/mock-fixtures.js`) so e2e tests exercise real flows
  when `AI_TEXT_PROVIDER=mock` (never allowed in production; outputs flagged `isMock`).

Data flow for a section: idea input + active outputs of the sections it `uses` + approved business
context → `generateText()` (schema) → new `project_outputs` version → UI. The profile builder maps
active outputs → profile tables → context draft → admin approval → reused by every later studio.

## Shared studio engine (Phase 2)
`src/server/studio/engine.js` — `createStudioEngine({ type, module, sections, schemas, buildInstructions,
buildInput, aiOptions, postProcess, validateState })` provides projects, scoped access, versioned
generation/edits, acceptance, per-version state and audit for every studio. UI counterparts:
`src/components/studio/studio-shell.jsx` and `section-panel.jsx`.

## Brand rendering (Phase 2)
```
AI (structured logo spec) ──► normalizeConcept() ──► renderLogoSvg()
                                                     ├─ fonts.js: bundled @fontsource WOFF → opentype.js glyph outlines
                                                     ├─ lucide icon geometry (curated list)
                                                     └─ SVG: paths + shapes only; escaped <title>; served with sandbox CSP
Browser: <img src=…svg> previews · PNG = canvas rasterization of the same SVG
```
Fonts for previews are served from `/api/v1/fonts/:key/:weight` and loaded with the FontFace API.

## Authentication
- Auth.js v4, Credentials provider, JWT cookie (`httpOnly`, `SameSite=Lax`,
  `Secure` in production), 7-day max age.
- JWT carries only `uid` and `sv` (session version). `getCurrentUser()` decodes
  it **and** checks the database (user exists, not deleted, `sessionVersion`
  matches), so a password reset revokes all sessions immediately.
- `src/proxy.js` is only an optimistic redirect; authorization is enforced in
  the data access layer.

## Authorization & tenancy
- Tenancy boundary = **workspace**. Users join via `workspace_members` with a role.
- Permissions are defined once in `src/server/permissions/roles.js`.
- Non-members receive **404** (not 403) so ids cannot be probed; members lacking
  a permission receive **403**.

## Central business context
`business_context_versions` stores versioned JSON snapshots by section
(`basics`, `offering`, `audience`, `goals`, `competitors`, `brandIdentity`,
`brandVoice`, `marketingPreferences`). Users save a DRAFT, then approve
selected sections. The AI orchestrator injects only approved sections of the
latest APPROVED version, wrapped in `<business_context>` and treated as data.

## AI orchestration
`generateText()` performs: permission check → per-user rate limit → workspace
usage limits → approved context → `ai_generations` row (PENDING) → provider
call → Zod validation of structured output → SUCCEEDED/FAILED + usage record
(tokens, micro-USD cost) → audit. Text and image providers are separate
registries. Mock providers exist for tests only, are flagged `isMock`, and are
refused in production.

## Storage
Bytes live in S3-compatible object storage under
`workspaces/<workspaceId>/<purpose>/<uuid>.<ext>`; MySQL keeps metadata only.
Uploads are type-checked by magic bytes (PNG, JPEG, GIF, WebP, PDF; SVG/HTML
rejected), size-limited and counted against the workspace storage quota.
Downloads use short-lived signed URLs.

## Cross-cutting security
Zod validation on every input · JSON-only mutations + Origin check (CSRF) ·
DB-backed rate limiting · bcrypt (cost 12) · hashed reset tokens · lockout after
8 failures · audit log for security-relevant actions · secrets only in server
env, validated at startup · security headers (CSP frame-ancestors, XFO, nosniff,
HSTS in production) · structured logs with secret redaction · generic 500s.

## Caching / rendering
`cacheComponents` is enabled (Next 16 default). Session reads happen inside
`<Suspense>` boundaries; authenticated pages are partially prerendered with the
user-specific content streamed.
