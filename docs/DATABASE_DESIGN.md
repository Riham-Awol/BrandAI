# Database Design

MySQL 8 · Prisma 7 (`prisma-client-js` generator + `@prisma/adapter-mariadb`
driver adapter) · UUID (`CHAR(36)`) primary keys · snake_case tables/columns ·
`created_at`/`updated_at` timestamps · soft delete via `deleted_at` where data
must be recoverable.

Schema: [`prisma/schema.prisma`](../prisma/schema.prisma) · Migrations: `prisma/migrations/`.

## Migrations
| Migration | Phase | Summary |
|---|---|---|
| `20261124114911_init_foundation` | 0 | Foundation tables below |

## Entity relationships

```
users 1─* workspace_members *─1 workspaces 1─* businesses 1─* business_context_versions
  │                                   │              │
  │                                   ├─* ai_generations *─1 business_context_versions (optional)
  │                                   │       └─* ai_usage_records
  │                                   ├─* usage_limits
  │                                   ├─* stored_files
  │                                   ├─* notifications
  │                                   └─* audit_logs
  └─* auth_tokens
rate_limit_buckets (standalone)
```

## Tables

| Table | Purpose | Key constraints / indexes | Delete behaviour |
|---|---|---|---|
| `users` | Accounts. `password_hash` (bcrypt), `session_version`, lockout counters, `is_platform_admin` | unique `email`; idx `deleted_at` | soft delete |
| `auth_tokens` | Password-reset / email-verification tokens (SHA-256 hash only) | unique `token_hash`; idx (`user_id`,`type`) | cascade with user |
| `workspaces` | Tenancy boundary (`PERSONAL`/`TEAM`/`AGENCY`) | unique `slug`; idx `owner_id`, `deleted_at` | soft delete; owner `RESTRICT` |
| `workspace_members` | Membership + role (`OWNER`/`ADMIN`/`EDITOR`/`VIEWER`) | unique (`workspace_id`,`user_id`) | cascade |
| `businesses` | A business profile inside a workspace (`stage`, `status`) | idx (`workspace_id`,`deleted_at`) | soft delete |
| `business_context_versions` | Versioned central business context (`data` JSON by section, `approved_sections`, `status` DRAFT/APPROVED/SUPERSEDED) | unique (`business_id`,`version`); idx (`business_id`,`status`) | cascade with business |
| `ai_generations` | Every AI call: module, task, provider, model, input, output, status, error, latency, context version used | idx (`workspace_id`,`created_at`), (`business_id`,`module`) | cascade with workspace |
| `ai_usage_records` | Tokens/images and estimated cost (`cost_micro_usd` BIGINT) per call | idx (`workspace_id`,`created_at`), (`user_id`,`created_at`) | cascade with workspace |
| `usage_limits` | Per-workspace limits by metric/period | unique (`workspace_id`,`metric`,`period`) | cascade |
| `stored_files` | Metadata for objects in cloud storage (key, mime, size, sha256, purpose) | unique `object_key`; idx (`workspace_id`,`deleted_at`) | soft delete |
| `notifications` | In-app notifications | idx (`user_id`,`read_at`) | cascade |
| `audit_logs` | Security/business audit trail (actor, action, entity, metadata, ip, UA) | idx (`workspace_id`,`created_at`), (`actor_id`,`created_at`), `action` | kept; FKs `SET NULL` |
| `rate_limit_buckets` | Fixed-window counters shared across instances | PK `key`; idx `reset_at` | expired rows overwritten |

## Versioning
`business_context_versions` is append-only per business (`version` increments).
One DRAFT may be open; approval marks it APPROVED and the previous APPROVED as
SUPERSEDED. Generations reference the context version they used.

## Tables from the master spec deferred to their phase
| Table | Phase | Reason |
|---|---|---|
| `business_products`, `business_services`, `business_locations`, `business_audiences`, `competitors`, `business_goals` | 1 | Shape is defined by the Launch Studio flows |
| `projects` | 1 | Defined with the guided journey |
| `brand_identities`, `brand_assets` | 2 | Brand Identity Studio (`brand_assets` will reference `stored_files`) |
| `integrations` (encrypted credentials) | 8 | Social/email integrations |
| `subscriptions` | 10 | Payment provider not yet selected |

## Conventions for new tables
- `id CHAR(36)` UUID, `workspace_id` (and `business_id` when relevant) with FK + index.
- Money as integer micro-units; never floats.
- JSON columns only for flexible, versioned payloads (AI output, context snapshots).
- Add every new table to `tests/helpers/db.js` (test reset list).
