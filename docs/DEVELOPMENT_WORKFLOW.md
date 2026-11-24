# Development Workflow

## Phase lifecycle (mandatory)

1. **Planning** — read `PHASE_ROADMAP.md`, `PHASE_STATUS.md`, this file and the
   ADRs; run the full test suite to verify the previous phase still works; write
   `docs/phases/PHASE_<n>.md` from [`phases/PHASE_TEMPLATE.md`](./phases/PHASE_TEMPLATE.md)
   (scope, DB changes, APIs, pages, acceptance criteria).
2. **Implementation** — module code in `src/modules/<key>/` (UI + module
   services) reusing `src/server/*` shared services; one Prisma migration per phase.
3. **Testing** — unit, integration (real MySQL), e2e (Playwright), security checks
   (authz + isolation tests for every new endpoint), responsive checks, full regression.
4. **Fixing** — all critical/high defects fixed and retested.
5. **Documentation** — update README, `API_DOCUMENTATION.md`, `DATABASE_DESIGN.md`,
   `SYSTEM_ARCHITECTURE.md`, `PHASE_STATUS.md`, new ADRs.
6. **Approval** — present the phase report; status becomes COMPLETE only after
   acceptance criteria pass. The next phase waits for explicit approval.

## Branching & commits
- Work on a feature branch; never push directly to `main`.
- Commit messages: imperative, scoped (`auth: add lockout`, `phase1: …`).
- No `.env*` files except `.env.example` / `.env.test.example`.
- Destructive DB or Git operations require explicit approval.

## Environments
| Env | Database | Notes |
|---|---|---|
| development | local MySQL `brandai_dev` | `EMAIL_PROVIDER=console` allowed |
| test | `*_test` database (truncated per test) | mock AI + memory storage, automatically |
| staging | managed MySQL (separate instance/schema) | Vercel Preview env vars |
| production | managed MySQL | mocks and console email are refused at startup |

## Commands
```bash
npm run dev               # local dev server
npm run lint
npm run test:unit         # no database needed
npm run test:integration  # needs TEST_DATABASE_URL (.env.test)
npm run build && npm run test:e2e   # e2e against a production build
npm run check             # lint + all vitest + build
npm run db:migrate -- --name <change>   # create + apply a migration (dev)
npm run db:deploy         # apply migrations (staging/prod/CI)
```

## Definition of done (per feature)
- Server-side validation (Zod) and authorization (`requireWorkspaceAccess` + permission).
- Workspace isolation test (another workspace's id → 404).
- Errors use `AppError` and the standard envelope; no secrets in logs.
- Loading, empty and error states in the UI; works at 390px width; light + dark.
- Docs updated. No mock data presented as real output.
