# Brand AI — permanent project instructions

@AGENTS.md

Brand AI is a commercial, multi-tenant SaaS built as a **modular monolith** in 10 phases.
Read `docs/PHASE_STATUS.md` first; never start a phase without explicit approval.

## Non-negotiables
- JavaScript/JSX only (no TypeScript). Next.js 16 App Router, Tailwind 4, shadcn/ui format, Lucide.
- MySQL 8 + Prisma 7 (`prisma-client-js` + MariaDB adapter). Schema changes only via migrations.
- Never commit `.env*` (except the `.example` files) or secrets. Secrets stay server-side.
- Ask before adding paid services or significant infrastructure, and before destructive DB/Git operations.
- Never present mock data as real output. Missing credentials → `SERVICE_NOT_CONFIGURED`, documented.
- Don't claim something works without running it.

## Architecture rules
- UI never queries the DB or checks permissions. Route handlers are thin: `route()` + `parseWith(schema)` + one service call + `ok()`.
- Every tenant-scoped service starts with `requireWorkspaceAccess(user, workspaceId, PERMISSIONS.X)` and filters every query by `scope.workspaceId`. Cross-tenant ids → 404.
- New permissions go in `src/server/permissions/roles.js`; never check roles directly.
- All AI calls go through `generateText()` in `src/server/ai/orchestrator.js` (context, limits, usage, audit). Never import a provider in a module.
- Business data for AI comes only from approved context sections (`getApprovedContext`). Don't re-ask users for data that exists.
- Files go through `src/server/storage/*` (cloud storage, magic-byte validation). Never persist to the local filesystem.
- Errors: throw `Errors.*`/`AppError`; responses use the `{ ok, data | error }` envelope.
- Session reads must be inside `<Suspense>` (cacheComponents is on). Use `getCurrentUser()` / `requireUser()`.
- Phase modules live in `src/modules/<key>/`, depend on `src/server/*`, never the reverse.
- UI uses semantic design tokens, includes loading/empty/error states, works at 390px and in dark mode.

## Each feature ships with
Zod validation · authz + workspace-isolation integration test · unit tests for pure logic · e2e for user flows · docs updates (API, DB, status).

## Commands
`npm run dev` · `npm run lint` · `npm run test:unit` · `npm run test:integration` (needs `.env.test`) · `npm run build && npm run test:e2e` · `npm run db:migrate -- --name x`
