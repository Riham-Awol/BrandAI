# Architecture Decision Records

| ADR | Decision | Status |
|---|---|---|
| [001](./001-modular-monolith-and-stack.md) | Modular monolith on Next.js 16 (JavaScript) | Accepted |
| [002](./002-authentication.md) | Auth.js (NextAuth v4) over Clerk | Accepted |
| [003](./003-database-prisma-mysql.md) | MySQL 8 + Prisma 7 with MariaDB driver adapter | Accepted |
| [004](./004-file-storage.md) | Storage abstraction: free database adapter (default) + S3-compatible | Accepted |
| [005](./005-ai-provider-abstraction.md) | Provider-independent AI orchestrator; Anthropic for text | Accepted (API key pending) |
| [006](./006-rate-limiting-and-jobs.md) | DB-backed rate limiting until Redis/BullMQ in Phase 8 | Accepted |
| [007](./007-design-system.md) | shadcn/ui-format components authored in-repo | Accepted |
| [008](./008-studio-projects-and-versioned-outputs.md) | Generic studio projects with versioned, schema-validated outputs | Accepted |

Template: Context · Options · Decision · Consequences.
| [009](./009-structured-vector-logos.md) | Free logo generation: AI-designed specs rendered as vector SVG | Accepted |
