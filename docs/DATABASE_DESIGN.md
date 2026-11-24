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
| `20261124210213_phase8_automation`, `20261124211204_phase8_job_locks` | 8 | `automation_settings`, `integrations`, `scheduled_items`, `email_contacts`, `email_campaigns`, `email_deliveries`, `reminders`, `automation_rules`, `automation_runs`, `job_locks` |
| `20261124202445_phase7_stationery` | 7 | `business_details`, `brand_materials`, `brand_material_revisions`, `business_documents`; `ProjectType.COMPANY_PROFILE`; enums `MaterialKind`, `DocumentType`, `DocumentStatus` |
| `20261124172827_phase6_website_builder` | 6 | `websites`, `website_versions`, `website_submissions`; enums `WebsiteType`, `WebsiteStatus`, `DomainStatus` |
| `20261124165358_phase5_design_studio` | 5 | `designs`, `design_revisions`; enum `DesignKind` |
| `20261124163027_phase4_social_studio` | 4 | `ProjectType.SOCIAL_STUDIO`; `social_posts`, `social_post_revisions` |
| `20261124134716_phase3_strategy_studio` | 3 | `ProjectType.STRATEGY_STUDIO`; `marketing_plans` |
| `20261124124604_phase2_brand_studio` | 2 | `ProjectType.BRAND_STUDIO`; `brand_identities`, `brand_assets`, `storage_objects` |
| `20261124121713_phase1_launch_studio` | 1 | `projects`, `project_outputs`, business profile tables; `businesses.value_proposition`, `businesses.business_model` |

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

businesses 1─* projects 1─* project_outputs *─1 ai_generations (optional)
businesses 1─* business_products | business_services | business_locations | business_audiences
           1─* business_customer_problems | competitors | business_goals
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
| `projects` *(P1)* | A studio session for a business (`type` LAUNCH_STUDIO; later studios add types). `input` JSON = idea input | idx (`workspace_id`,`deleted_at`), (`business_id`,`type`) | soft delete |
| `project_outputs` *(P1)* | Append-only versions of a section's output: `section`, `version`, `source` AI/EDIT, `content` JSON, `state` JSON (user progress e.g. checklist), `is_accepted`, `is_mock`, `feedback`, `generation_id` | unique (`project_id`,`section`,`version`); idx (`project_id`,`section`,`is_accepted`) | cascade with project |
| `business_products`, `business_services` *(P1)* | Offering: name, description, price range, order | idx (`business_id`,`sort_order`) | cascade with business |
| `business_locations` *(P1)* | label, city, region, country, `is_primary`, `is_online` | idx `business_id` | cascade |
| `business_audiences` *(P1)* | Segments: name, description, demographics, needs, `is_primary` | idx (`business_id`,`sort_order`) | cascade |
| `business_customer_problems` *(P1)* | problem, solution, severity | idx (`business_id`,`sort_order`) | cascade |
| `competitors` *(P1)* | name, website, description, strengths, weaknesses | idx (`business_id`,`sort_order`) | cascade |
| `business_goals` *(P1)* | title, description, timeframe, metric | idx (`business_id`,`sort_order`) | cascade |

| `brand_identities` *(P2)* | Immutable approved identity snapshots (`data` JSON: logo spec, palette, typography, tagline, personality, voice, guidelines), `status` APPROVED/SUPERSEDED, `version`, approver | unique (`business_id`,`version`); idx (`business_id`,`status`) | cascade with business |
| `brand_assets` *(P2)* | Uploaded brand files: `kind` (LOGO/ICON/IMAGE/DOCUMENT/OTHER), name, description → `stored_files` | idx (`business_id`,`deleted_at`) | soft delete (file bytes deleted) |
| `storage_objects` *(P2)* | Bytes for `STORAGE_PROVIDER=database` (`LONGBLOB`, ≤5 MB enforced by the adapter) | PK `object_key` | deleted with the file |

| `marketing_plans` *(P3)* | Immutable approved marketing plans (`data` JSON: settings, all section contents, computed budget), `status` APPROVED/SUPERSEDED, `version`, approver | unique (`business_id`,`version`); idx (`business_id`,`status`) | cascade with business |

| `social_posts` *(P4)* | Planned/written post: `scheduled_date` (DATE), `platform`, `format`, pillar, title, objective, `is_promotion`, `status` IDEA/DRAFT/READY, current `content` JSON, `version`, `is_mock`, source `calendar_output_id` | idx (`project_id`,`scheduled_date`), (`workspace_id`,`deleted_at`), `business_id` | soft delete |
| `automation_settings` *(P8)* | Per workspace: `mode` (DRAFT_ONLY/APPROVAL_REQUIRED/AUTOMATED), daily publish/email limits, separate approver, time zone | unique `workspace_id` | cascade |
| `integrations` *(P8)* | Connected channel: `type` (WEBHOOK/TELEGRAM/FACEBOOK_PAGE), display `config`, AES-256-GCM `secret_encrypted`, status, last use/error | idx (`workspace_id`,`deleted_at`) | soft delete (secret wiped) |
| `scheduled_items` *(P8)* | Planned outward action: source (post/campaign/custom), channel, content snapshot, `scheduled_at`, status workflow, requester/approver, attempts, lock | idx (`status`,`scheduled_at`), (`workspace_id`,`scheduled_at`), (`source_type`,`source_id`) | soft delete |
| `email_contacts` *(P8)* | Audience: email, name, consent source/date, `unsubscribed_at`, unique unsubscribe token | unique (`business_id`,`email`) | cascade |
| `email_campaigns` / `email_deliveries` *(P8)* | Campaign content and status; one delivery per contact (status, provider, error) | unique (`campaign_id`,`contact_id`) | soft delete / cascade |
| `reminders`, `automation_rules`, `automation_runs`, `job_locks` *(P8)* | Personal reminders; preset rule recipes with params; automation history; scheduler lease lock | idx by workspace/time | cascade |
| `business_details` *(P7)* | 1:1 business: legal name, address, contact, registration/tax numbers, bank details, `currency`, `default_tax_rate_bp`, `payment_terms_days`, invoice/quote prefixes and next numbers | unique `business_id` | cascade with business |
| `brand_materials` *(P7)* | Branded item: `kind` (card, letterhead, tshirt, uniform, bag, mug, label, packaging), `name`, `spec` JSON, `version`, `is_mock` | idx (`workspace_id`,`deleted_at`), (`business_id`,`kind`) | soft delete |
| `brand_material_revisions` *(P7)* | Every saved version of a material's spec | unique (`material_id`,`version`) | cascade |
| `business_documents` *(P7)* | Invoice/quote: `number`, `status`, `customer` JSON, `issue_date`/`due_date` (DATE), `currency`, `lines` JSON (decimal strings), intro/notes/terms, BigInt `subtotal_minor`/`tax_minor`/`total_minor` (computed in code), `source_quote_id`, `sent_at`, `paid_at` | unique (`business_id`,`type`,`number`); idx (`business_id`,`type`,`status`) | soft delete (unsent drafts only) |
| `websites` *(P6)* | Website per business: `type`, `name`, unique `slug`, `status` DRAFT/PUBLISHED/UNPUBLISHED, draft `config` JSON, `draft_revision` (optimistic concurrency), `published_version`, unique `custom_domain` + `domain_status`/`domain_token`, `is_mock` | idx (`workspace_id`,`deleted_at`), `business_id` | soft delete (slug/domain released) |
| `website_versions` *(P6)* | Immutable published snapshot: `config` + resolved `brand` (incl. vector logo) | unique (`website_id`,`version`) | cascade with website |
| `website_submissions` *(P6)* | Contact/order messages from a published site (`kind`, name, email, phone, message, item, page, salted `ip_hash`, `read_at`) | idx (`website_id`,`created_at`), `workspace_id` | cascade; deletable by editors |
| `designs` *(P5)* | Saved design: `kind`, `format`, `name`, `brief` JSON, current `spec` JSON, `image_file_id`, `source_post_id`, `version`, `is_mock` | idx (`workspace_id`,`deleted_at`), (`business_id`,`kind`) | soft delete |
| `design_revisions` *(P5)* | Every visual version of a design (`version`, `format`, `spec`, `image_file_id`) | unique (`design_id`,`version`) | cascade with design |
| `social_post_revisions` *(P4)* | Every AI write or user edit of a post (`version`, `source` AI/EDIT, `content`, feedback, generation link) | unique (`post_id`,`version`) | cascade with post |

Generated logo files are **not stored**: they are rendered on demand from the approved identity's logo spec.

Profile tables carry `business_id` only (no `workspace_id`): they are reached exclusively through an
authorized, workspace-scoped business, so the workspace is not duplicated. At most one primary location
and one primary audience are kept (enforced by the profile service).

## Versioning
`project_outputs` is append-only per (project, section): every AI generation and every user edit
creates a new version; one version per section may be accepted. The accepted version (else the latest)
is the "active" one fed into later sections and the profile builder.

`business_context_versions` is append-only per business (`version` increments).
One DRAFT may be open; approval marks it APPROVED and the previous APPROVED as
SUPERSEDED. Generations reference the context version they used.

## Tables from the master spec deferred to their phase
| Table | Phase | Reason |
|---|---|---|
| `integrations` (encrypted credentials) | 8 | Social/email integrations |
| `subscriptions` | 10 | Payment provider not yet selected |

## Conventions for new tables
- `id CHAR(36)` UUID, `workspace_id` (and `business_id` when relevant) with FK + index.
- Money as integer micro-units; never floats.
- JSON columns only for flexible, versioned payloads (AI output, context snapshots).
- Add every new table to `tests/helpers/db.js` (test reset list).
