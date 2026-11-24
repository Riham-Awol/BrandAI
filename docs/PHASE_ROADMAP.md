# Brand AI — Phase Roadmap

One modular monolith, built in ten connected phases. A phase starts only after
the previous one passes its acceptance criteria and is approved (see
[PHASE_STATUS.md](./PHASE_STATUS.md) and [DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md)).

| Phase | Module (`src/modules/…`) | Main output | Depends on |
|---|---|---|---|
| 0 ✅ | Foundation (initialization) | Auth, workspaces, isolation, DB, AI/storage abstractions, design system, tests | — |
| 1 🟡 | AI Business Launch Studio (`launch`) | Structured business profile + launch plan | 0 |
| 2 | AI Brand Identity Studio (`brand`) | Approved, reusable brand identity | 1 (business context) |
| 3 | AI Marketing Strategy Studio (`strategy`) | Complete marketing strategy | 1, 2 |
| 4 | AI Social Media Studio (`social`) | Ready-to-use social content | 2, 3 |
| 5 | AI Creative Design Studio (`design`) | Brand-consistent marketing designs | 2 (brand assets), storage |
| 6 | AI Website Builder (`website`) | Published business website (structured page configs, no executed AI code) | 1, 2, 5 |
| 7 | Stationery & Merchandise Studio (`stationery`) | Branded business materials | 2, 5 |
| 8 | Marketing Calendar & Automation (`automation`) | Permission-based automation workflow (draft-only / approval-required / authorized-with-limits) | 4, 5; introduces Redis + BullMQ |
| 9 | Analytics & Business Intelligence (`analytics`) | Actionable insights and reports | 4, 6, 8 (integrations) |
| 10 | SaaS Administration & Production Launch (`admin`) | Production-ready commercial SaaS | all |

✅ approved · 🟡 complete, awaiting approval

## Cross-phase rules

- Every module consumes the **central business context** through
  `getApprovedContext()` / the AI orchestrator. No module re-asks for data that
  already exists in an approved context section.
- Each phase adds its tables via **its own Prisma migration**.
- Individual tools must work without completing the guided journey (an
  existing business can jump straight to Phase 4, for example).

## Planned infrastructure introductions

| When | What | Why |
|---|---|---|
| Phase 2 | Image-generation provider (cost decision → approval required) | Logos and visual assets |
| Phase 2/5 | Storage provider credentials (S3-compatible or Cloudinary adapter) | Persist brand and design assets |
| Phase 8 | Redis + BullMQ (approval required) | Scheduling, long-running jobs; also replaces DB rate-limit store |
| Phase 10 | Payment provider (approval required) | Subscriptions and AI credits |
