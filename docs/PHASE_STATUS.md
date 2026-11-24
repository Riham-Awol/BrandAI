# Phase Status

| Phase | Status | Approved |
|---|---|---|
| 0 — Foundation | **COMPLETE — awaiting approval** | ☐ |
| 1 — Business Launch Studio | NOT STARTED (blocked on Phase 0 approval) | ☐ |
| 2–10 | NOT STARTED | ☐ |

**Current phase:** 0 (Project initialization) · **Last updated:** 2026-11-24

---

## Phase 0 — Foundation

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
