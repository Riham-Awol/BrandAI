# API Documentation (v1)

Base path: `/api/v1`. JSON only. Authentication uses the Auth.js session cookie
set by `/api/auth/*`.

## Conventions
**Success:** `{ "ok": true, "data": … }`
**Error:** `{ "ok": false, "error": { "code": "…", "message": "…", "details"?: … } }`

| HTTP | code | Meaning |
|---|---|---|
| 401 | `UNAUTHENTICATED` | No valid session |
| 402 | `USAGE_LIMIT_REACHED` | Workspace quota exhausted |
| 403 | `FORBIDDEN` | Member without permission, or cross-origin mutation |
| 404 | `NOT_FOUND` | Missing **or belongs to another workspace** |
| 409 | `CONFLICT` | Duplicate / invalid state |
| 422 | `VALIDATION_ERROR` | `details` = `{ field: [messages] }` |
| 429 | `RATE_LIMITED` | `Retry-After` header set |
| 503 | `SERVICE_NOT_CONFIGURED` | External provider credentials missing |
| 500 | `INTERNAL_ERROR` | Generic; details only in server logs |

Mutations must send `Content-Type: application/json` (files: multipart). Requests
with a foreign `Origin` header are rejected. Default rate limit: 120 req/min per user.

## Auth.js endpoints (`/api/auth/*`)
Standard NextAuth v4 routes: `GET /api/auth/csrf`, `POST /api/auth/callback/credentials`
(`email`, `password`, `csrfToken`), `POST /api/auth/signout`, `GET /api/auth/session`.
Login is limited to 10 attempts / 15 min per IP and per email; accounts lock for
15 min after 8 consecutive failures. The browser uses `signIn()` / `signOut()` from `next-auth/react`.

## Public endpoints
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/health` | — | `{ status, database, time }` (503 if DB down) |
| POST | `/auth/register` | `{ name, email, password }` | 201 `{ user }` — also creates a personal workspace. 5/hour/IP |
| POST | `/auth/password/forgot` | `{ email }` | 202, identical response whether or not the account exists. 5/hour/IP |
| POST | `/auth/password/reset` | `{ token, password }` | 200; invalidates all sessions. Token single-use, 30 min |

Password rules: 10–72 chars, letters plus a number or symbol.

## Authenticated endpoints
| Method | Path | Permission | Body / notes |
|---|---|---|---|
| GET | `/me` | session | `{ user, workspaces[] }` |
| GET | `/notifications?unread=true` | session | own notifications |
| PATCH | `/notifications` | session | `{ ids: uuid[] }` → mark read |
| GET | `/workspaces` | session | workspaces the user belongs to (+ role) |
| POST | `/workspaces` | session | `{ name, type: TEAM\|AGENCY\|PERSONAL }` → creator is OWNER |
| GET | `/workspaces/:workspaceId` | `workspace:read` | workspace + `role`, `permissions[]`, `memberCount` |
| GET | `/workspaces/:workspaceId/usage` | `usage:read` | `[{ metric, period, periodStart, used, limit }]` (numbers as strings) |
| GET | `/workspaces/:workspaceId/businesses` | `business:read` | list (non-deleted) |
| POST | `/workspaces/:workspaceId/businesses` | `business:create` | `{ name, industry?, description?, stage? }` |
| GET | `/workspaces/:workspaceId/businesses/:businessId` | `business:read` | |
| PATCH | `/workspaces/:workspaceId/businesses/:businessId` | `business:update` | partial of create body |
| DELETE | `/workspaces/:workspaceId/businesses/:businessId` | `business:delete` | soft delete |
| GET | `/workspaces/:workspaceId/businesses/:businessId/context` | `business:read` | `{ draft, approved }` |
| PUT | `/workspaces/:workspaceId/businesses/:businessId/context` | `business:update` | `{ data: { <section>: object }, changeNote? }` saves the open draft |
| POST | `/workspaces/:workspaceId/businesses/:businessId/context/approve` | `context:approve` | `{ sections: string[] }` approves the draft |
| POST | `/workspaces/:workspaceId/files` | `files:upload` | multipart: `file`, `purpose` (`brand-asset`\|`business-document`\|`design-source`), `businessId?`. Max 10 MB; PNG/JPEG/GIF/WebP/PDF |

### Business profile (Phase 1)
| Method | Path | Permission | Body / notes |
|---|---|---|---|
| GET | `/workspaces/:workspaceId/businesses/:businessId/profile` | `business:read` | `{ profile, context: { draft, approved }, permissions }` |
| PUT | `/workspaces/:workspaceId/businesses/:businessId/profile` | `business:update` | Full profile (see `src/validation/profile.js`): `name, industry?, description?, stage, valueProposition?, businessModel?, products[], services[], locations[], audiences[], problems[], competitors[], goals[]`. Lists are **replaced**. Also saves a context draft → `{ profile, contextDraft: { id, version } }` |

### Launch Studio (Phase 1)
Base: `/workspaces/:workspaceId/launch-projects`. Sections: `idea_analysis`, `names`, `industry`,
`audience`, `problems`, `competitors`, `business_model`, `strategy`, `business_plan`, `launch_checklist`
(schemas in `src/modules/launch/schemas.js`). Unknown sections → 404.

| Method | Path | Permission | Body / notes |
|---|---|---|---|
| GET | `/` | `business:read` | projects with `completedSections` / `totalSections` |
| POST | `/` | `business:create` (new business) or `business:update` (with `businessId`) | `{ idea, country, city?, stage, budget, businessName?, audienceHint?, goals?, experience?, businessId? }` → 201 `{ id, name, businessId }` |
| GET | `/:projectId` | `business:read` | project, business, `permissions`, and per section `{ active, versions[] }` (active = accepted, else latest) |
| PATCH | `/:projectId` | `business:update` | `{ name?, input?, status? }` |
| DELETE | `/:projectId` | `business:delete` | soft delete |
| POST | `/:projectId/sections/:section/generate` | `ai:generate` | `{ feedback? }` (≤1000 chars, revision instructions) → 201 new version. Rate limit 20/min/user, workspace AI limits apply. `503 SERVICE_NOT_CONFIGURED` without AI credentials; `422 AI_REFUSED`, `502 AI_INVALID_OUTPUT` / `AI_OUTPUT_TRUNCATED` on AI failures. `maxDuration` 300 s |
| PUT | `/:projectId/sections/:section` | `business:update` | `{ content }` validated against the section schema (422 with `details` keyed by path, e.g. `suggestions.0.name`) → 201 new version (`source: EDIT`) |
| GET | `/:projectId/sections/:section/versions/:outputId` | `business:read` | one version |
| POST | `/:projectId/sections/:section/accept` | `business:update` | `{ outputId }` — marks it accepted (one per section) |
| PATCH | `/:projectId/checklist` | `business:update` | `{ outputId, completed: ["<category>-<item>", …] }` → `{ state, total }` |
| GET | `/:projectId/profile-draft` | `business:read` | profile pre-filled from active outputs (not saved) + saved profile + context |
| GET | `/:projectId/export` | `business:read` | `text/markdown` attachment (launch pack) |

### Brand Identity Studio (Phase 2)
Base: `/workspaces/:workspaceId/brand-projects`. Sections: `personality`, `voice`, `taglines`, `palettes`,
`typography`, `logo_concepts`, `guidelines` (schemas: `src/modules/brand/schemas.js`). Generate / edit /
versions / accept work exactly like the Launch Studio endpoints.

| Method | Path | Permission | Body / notes |
|---|---|---|---|
| GET / POST | `/` | `business:read` / `business:update` | POST `{ businessId, styleKeywords[], colorPreferences?, avoid?, inspiration? }` |
| GET / DELETE | `/:projectId` | `business:read` / `business:delete` | |
| POST | `/:projectId/sections/:section/generate` | `ai:generate` | `{ feedback? }`; colours normalized; invalid colours → `502 AI_INVALID_OUTPUT` |
| PUT | `/:projectId/sections/:section` | `business:update` | `{ content, state? }` → new version; invalid hex → 422 keyed by path |
| PATCH | `/:projectId/sections/:section/state` | `business:update` | `{ outputId, state: { selected } }` for taglines/palettes/typography/logo_concepts |
| GET | `/:projectId/sections/:section/versions/:outputId` | `business:read` | |
| POST | `/:projectId/sections/:section/accept` | `business:update` | `{ outputId }` |
| GET | `/:projectId/logo/:outputId/:index?variant&theme&height` | `business:read` | `image/svg+xml` (sandboxed CSP) |
| POST | `/:projectId/logo-preview` | `business:read` | `{ concept, variant, theme }` → `{ svg, warnings }` |
| GET | `/:projectId/identity` | `business:read` | `{ draft: { complete, missing, data }, approved }` |
| POST | `/:projectId/identity` | `context:approve` | approve → new identity version + context publish; `409` lists missing sections |

Variants: `horizontal`, `stacked`, `mark`, `wordmark`; themes: `color`, `mono`, `inverse`.

### Marketing Strategy Studio (Phase 3)
Base: `/workspaces/:workspaceId/strategy-projects`. Sections: `personas`, `competitor_analysis`, `channels`,
`objectives`, `budget`, `advertising`, `kpis`, `strategy` (schemas: `src/modules/strategy/schemas.js`).
Project / section / generate / versions / accept endpoints are identical to the other studios.

| Method | Path | Permission | Body / notes |
|---|---|---|---|
| GET / POST | `/` | `business:read` / `business:update` | POST `{ businessId, primaryGoal, monthlyBudget?, currency, timeframeMonths (3/6/12), focusMarkets?, constraints? }` |
| GET | `/:projectId/plan` | `business:read` | `{ draft: { complete, missing, data: { sections, budget (computed), settings } }, approved }` |
| POST | `/:projectId/plan` | `context:approve` | approve → new plan version + `marketingPreferences` context; `409` lists missing sections |
| GET | `/:projectId/export?format=markdown\|budget-csv\|kpis-csv` | `business:read` | file download |
| GET | `/workspaces/:ws/businesses/:biz/marketing-plan` | `business:read` | `{ business, plan }` (approved or null) |
| GET | `/workspaces/:ws/businesses/:biz/marketing-plan/export?format=…` | `business:read` | approved plan download; 404 if none |

### Social Media Studio (Phase 4)
Base: `/workspaces/:workspaceId/social-projects`. Sections: `pillars`, `calendar` (schemas:
`src/modules/social/schemas.js`); project/section/generate/versions/accept endpoints as in other studios.

| Method | Path | Permission | Body / notes |
|---|---|---|---|
| GET / POST | `/` | `business:read` / `business:update` | POST `{ businessId, month: "YYYY-MM", platforms: [INSTAGRAM\|FACEBOOK\|TIKTOK\|LINKEDIN], postsPerWeek (1-14), focus?, includePromotions }` |
| GET | `/:projectId/posts` | `business:read` | posts with computed `checks` (captionLength, hashtagCount, durationSeconds, warnings) |
| POST | `/:projectId/posts` | `business:update` (+ `ai:generate` when `generate: true`) | quick post `{ date, platform, format, title, pillar?, objective?, isPromotion, generate }` |
| POST | `/:projectId/posts/from-calendar` | `business:update` | creates IDEA posts from the active calendar (idempotent) → `{ created, replaced \| alreadyCreated }`; 409 without a calendar |
| POST | `/:projectId/posts/generate` | `ai:generate` | `{ postIds: uuid[1..6], feedback? }` → one AI call → `{ written, missing, isMock }` |
| GET / PATCH / DELETE | `/:projectId/posts/:postId` | read / `business:update` | PATCH `{ title?, date?, status?, isPromotion?, content? }` (content → new revision; READY requires content; date must be in the plan month) |
| GET | `/:projectId/export?format=csv\|markdown` | `business:read` | file download |

### Creative Design Studio (Phase 5)
Base: `/workspaces/:workspaceId/designs`. Kinds `POSTER|FLYER|AD|BANNER|PRODUCT|EVENT|SOCIAL`; formats and the
formats allowed per kind in `src/modules/design/catalog.js`; spec schema in `src/modules/design/schemas.js`.

| Method | Path | Permission | Body / notes |
|---|---|---|---|
| GET | `/?businessId=` | `business:read` | saved designs (newest first) |
| POST | `/generate` | `ai:generate` | `{ businessId, kind, format, brief (5-2000), details?, cta?, imageFileId?, sourcePostId? }` → `{ options: [{ spec, svg, warnings }]×3, brandApproved, isMock }`; nothing saved |
| POST | `/preview` | `business:read` | `{ businessId, format, spec, imageFileId? }` → `{ svg, warnings, brandApproved }` |
| POST | `/` | `business:update` | save `{ businessId, kind, format, brief, spec, imageFileId?, sourcePostId?, isMock }` → design (version 1) |
| GET / PATCH / DELETE | `/:designId` | read / `business:update` | PATCH `{ name?, format?, spec?, imageFileId? }` (visual change → new version) |
| POST | `/:designId/revisions/:version` | `business:update` | restore a version (creates a new version) |
| POST | `/:designId/duplicate` | `business:update` | copy as a new design |
| GET | `/:designId/render?format=&download=1` | `business:read` | `image/svg+xml` (CSP `img-src data:; sandbox`) |
| GET | `/images?businessId=` | `business:read` | image brand assets usable in designs `[{ fileId, name }]` |
| GET | `/from-post/:postId` | `business:read` | brief pre-fill from a social post |

Images must be PNG/JPEG/GIF/WebP files of the **same business** (422 otherwise); sizes outside the kind → 422.

### Website Builder (Phase 6)
Base: `/workspaces/:workspaceId/websites`. Config schema: `siteConfigSchema` in `src/modules/website/schemas.js`.

| Method | Path | Permission | Body / notes |
|---|---|---|---|
| GET / POST | `/` | `business:read` / `business:update` (+ `ai:generate` when generating) | POST `{ businessId, type: BUSINESS\|LANDING\|PORTFOLIO\|STORE, theme: modern\|classic\|bold, brief?, generate }` |
| GET / PATCH / DELETE | `/:websiteId` | read / `business:update` / `business:delete` | PATCH `{ name?, slug?, config?, baseRevision? }` → 409 when `baseRevision` is stale; images must be the business's image assets |
| POST | `/:websiteId/sections/regenerate` | `ai:generate` + `business:update` | `{ pageSlug, sectionId, instructions? }` (not for testimonials) |
| GET / POST | `/:websiteId/publish` | read / `website:publish` | GET lists published versions; POST publishes the draft as a new version |
| POST | `/:websiteId/unpublish` | `website:publish` | takes the site offline |
| POST | `/:websiteId/versions/:version` | `business:update` | copies a published version into the draft |
| PUT / DELETE | `/:websiteId/domain` | `website:publish` | PUT `{ domain }` → DNS records (CNAME + TXT) |
| POST | `/:websiteId/domain/verify` | `website:publish` | checks the TXT record → VERIFIED / FAILED |
| GET | `/:websiteId/messages` | `business:update` | contact/order messages |
| PATCH / DELETE | `/:websiteId/messages/:messageId` | `business:update` | PATCH `{ read }` |
| GET | `/:websiteId/media/:fileId` | `business:read` | business image for the editor preview |

Public (no login):

| Method | Path | Notes |
|---|---|---|
| GET | `/sites/:slug[/:page]` (page) | published snapshot only; verified custom domains are rewritten here by the proxy |
| POST | `/api/v1/sites/:site/contact` | form-encoded `{ name, email, phone?, message, kind, item?, page, website (honeypot) }` → 303 back with `?sent=1` / `?error=1`; rate limit `siteForm` (5 / 10 min / IP) |
| GET | `/api/v1/sites/:site/media/:fileId` | images referenced by the published version only |

### Stationery & Merchandise (Phase 7)
Money is returned as minor-unit **strings** (`totalMinor: "14400"` = £144.00); dates are `YYYY-MM-DD`.

| Method | Path | Permission | Body / notes |
|---|---|---|---|
| GET / PUT | `/workspaces/:ws/businesses/:biz/details` | read / `business:update` | business details (legal name, address, contact, numbers, bank details, currency, `defaultTaxRate` %, `paymentTermsDays`, prefixes, next numbers) |
| GET / POST | `/workspaces/:ws/materials` | read / `business:update` | POST `{ businessId, kind, spec, isMock }` |
| POST | `/workspaces/:ws/materials/options` | `business:update` (cards, letterheads) / `ai:generate` (others) | `{ businessId, kind, brief?, person? }` → 3 `{ spec, views[] }`; nothing saved |
| POST | `/workspaces/:ws/materials/preview` | read | `{ businessId, kind, spec }` → `{ views[] }` |
| GET / PATCH / DELETE | `/workspaces/:ws/materials/:id` | read / `business:update` | PATCH `{ spec }` → new version |
| POST | `/workspaces/:ws/materials/:id/revisions/:version` · `/duplicate` | `business:update` | restore / copy |
| GET | `/workspaces/:ws/materials/:id/render?view=&download=1` | read | SVG of one view (front, back, page, mockup, artwork, label, dieline) |
| GET / POST | `/workspaces/:ws/documents[?type=INVOICE\|QUOTE]` | read / `business:update` | POST `{ businessId, type, customer, issueDate, dueDate?, currency, lines[{ description, quantity, unitPrice, taxRate }], intro?, notes?, terms? }` → numbered draft with computed totals |
| GET | `/workspaces/:ws/documents/defaults?businessId&type` | read | currency, tax rate, dates from business details |
| POST | `/workspaces/:ws/documents/draft-text` | `ai:generate` | `{ businessId, type, brief?, lines[], customerName? }` → `{ intro, notes, terms }` (no numbers; not saved) |
| GET / PUT / DELETE | `/workspaces/:ws/documents/:id` | read / `business:update` | PUT replaces a **draft** (409 otherwise); DELETE only unsent drafts |
| POST | `/workspaces/:ws/documents/:id/status` | `business:update` | `{ status }` following the allowed transitions (409 otherwise) |
| POST | `/workspaces/:ws/documents/:id/convert` · `/duplicate` | `business:update` | quote → draft invoice (idempotent) / copy |
| … | `/workspaces/:ws/company-profiles` | as other studios | studio engine routes (project, sections, generate, accept, versions) |

Printable pages (session required): `/print/documents/:id`, `/print/profiles/:id`.

### Calendar & Automation (Phase 8)
Base: `/workspaces/:ws/automation`.

| Method | Path | Permission | Body / notes |
|---|---|---|---|
| GET / PUT | `/settings` | read / `automation:manage` (+ `automation:autopilot` to switch ON `AUTOMATED`) | `{ mode: DRAFT_ONLY\|APPROVAL_REQUIRED\|AUTOMATED, dailyPublishLimit, dailyEmailLimit, requireSeparateApprover, timezone }`; GET adds `permissions` and `platform` status |
| GET / POST | `/integrations` | read / `automation:manage` | POST `{ type: WEBHOOK, name, url }` \| `{ type: TELEGRAM, name, botToken, chatId }` \| `{ type: FACEBOOK_PAGE, name, pageId, accessToken }`; secrets never returned; webhook `reveal.signingSecret` once |
| PATCH / DELETE | `/integrations/:id` | `automation:manage` | PATCH `{ enabled }` |
| POST | `/integrations/:id/test` | `automation:manage` | → `{ ok, ref? \| error }` |
| GET / POST | `/items` | read / `business:update` | POST `{ businessId, sourceType: SOCIAL_POST\|EMAIL_CAMPAIGN\|CUSTOM, sourceId?, text?, link?, integrationId?, scheduledAt (ISO), submit }`; GET `?from&to&status=A,B` |
| GET | `/items/:id` | read | |
| POST | `/items/:id/submit` · `/cancel` · `/reschedule` `{ scheduledAt }` · `/posted` `{ externalUrl? }` | `business:update` | |
| POST | `/items/:id/decision` | `automation:approve` | `{ approve, note? }` (separate-approver rule) |
| POST | `/items/:id/publish-now` | `automation:approve` | immediate, audited; daily limits still apply |
| GET | `/sources?businessId` | read | written posts and draft campaigns |
| GET | `/calendar?from&to` | read | ≤ 100 days |
| GET / POST · PATCH / DELETE | `/reminders` · `/reminders/:id` | member (own reminders) | `{ title, dueAt, note?, link? }` · `{ done }` |
| GET / POST · PATCH / DELETE | `/rules` · `/rules/:id` | read / `automation:manage` | `{ template, name, integrationId?, time? }` |
| GET | `/history?outcome&kind` | read | |
| POST | `/run` | `automation:manage` | "Run now" for this workspace |
| GET / POST | `/campaigns` | read / `business:update` | `{ businessId, name, subject, preheader, content: { heading, paragraphs[], ctaLabel, ctaUrl } }` |
| POST | `/campaigns/draft` | `ai:generate` | `{ businessId, brief }` → AI draft (not saved) |
| GET / PUT / DELETE | `/campaigns/:id` | read / `business:update` | only drafts editable |
| GET | `/campaigns/:id/preview` | read | HTML (sandboxed) |
| POST | `/campaigns/:id/test` | `business:update` | test email to the signed-in user |
| GET / POST | `/contacts?businessId` | `business:update` | POST `{ businessId, email, name?, consentSource, consentConfirmed: true }` |
| POST | `/contacts/import` | `business:update` | `{ businessId, csv, consentSource, consentConfirmed: true }` → `{ added, skipped, invalid }` |
| DELETE | `/contacts/:id` | `business:update` | |

Public: `POST /api/v1/cron/run` (Bearer `CRON_SECRET`); `POST /api/v1/unsubscribe/:token` (one-click; `?redirect=1`
for the form); page `/u/:token`. Notifications: `GET /api/v1/notifications`, `PATCH { ids }`.

### Analytics & Insights (Phase 9)
Base: `/workspaces/:ws/analytics`. Query `days=7|30|90` (default 30) and optional `businessId` (another
workspace's business → 404). Numbers are computed in code; money is returned as minor-unit strings.

| Method | Path | Permission | Body / notes |
|---|---|---|---|
| GET | `` (base) | `business:read` | Report: `period`, `website` (`kpis`, `daily`, `pages`, `sources`, `devices`), `email`, `publishing`, `engagement`, `sales` (`paid`, `outstanding`), `gaps` |
| GET | `/export?days&businessId&format=csv\|md` | `business:read` | file download (CSV cells guarded against formula injection) |
| POST | `/insights` | `ai:generate` | `{ days, businessId? }` → saved report with checked AI insights (`verified` flags, unknown metric keys dropped) |
| GET | `/reports?businessId` · `/reports/:id` | `business:read` | latest 20 · one report |
| DELETE | `/reports/:id` | `business:update` | |
| GET | `/reports/:id/export?format=md\|csv` | `business:read` | |
| GET | `/posts?days&businessId` | `business:read` | published posts with entered results, `canEdit` |
| PUT | `/posts/:itemId/metrics` | `business:update` | `{ reach?, impressions?, likes?, comments?, shares?, saves?, clicks? }` (≥ 1 number; published, non-email items only) |
| GET / PUT | `/settings` | read / `analytics:manage` | `{ trackSiteVisits, trackEmailEngagement, retentionDays (30–730) }` |

Public tracking (no auth, rate-limited per IP, always 200 so failures are invisible):
`GET /api/v1/sites/:site/px?p=<page slug>&s=<source>` → 1×1 GIF (bots, DNT/GPC browsers, unknown pages and
tracking-off workspaces are ignored); `GET /api/v1/email/:token/open` → GIF; `GET /api/v1/email/:token/click` →
302 to the campaign's stored https link (token = HMAC-signed delivery id; any other input is ignored, so it can't
redirect elsewhere). Printable report page: `/print/analytics/:reportId`.

### Account, team, plans and administration (Phase 10)
| Method | Path | Permission | Body / notes |
|---|---|---|---|
| GET / PATCH | `/me/account` | signed in | PATCH `{ name }` |
| POST | `/me/password` | signed in | `{ currentPassword, newPassword }` → every session signed out |
| POST | `/me/sessions/revoke` | signed in | sign out everywhere |
| POST | `/me/email-verification` · `/auth/verify-email` (public) | signed in · token | `{ token }` |
| POST | `/me/mfa/setup` · `/me/mfa/enable` · `/me/mfa/disable` · `/me/mfa/recovery-codes` | signed in | setup → `{ secret, otpauthUri, qrCode }`; enable `{ code }` → `{ recoveryCodes }`; disable `{ password, code }` |
| POST | `/me/delete` | signed in | `{ password, confirm: "DELETE" }` (refused while owning a shared workspace) |
| POST | `/workspaces` | signed in | `{ name, type: TEAM\|AGENCY }` (max 10 owned) |
| GET / PATCH / DELETE | `/workspaces/:ws/settings` | read / `workspace:update` / `workspace:delete` | DELETE `{ confirmName }` (cancels a paid plan) |
| GET | `/workspaces/:ws/members` | `members:read` | members, pending invitations, seats, permissions |
| POST · DELETE | `/workspaces/:ws/invitations` · `/invitations/:id` | `members:manage` (admins: owner only) | `{ email, role: ADMIN\|EDITOR\|VIEWER }` |
| POST | `/invitations/accept` | signed in (matching email) | `{ token }` |
| PATCH · DELETE | `/workspaces/:ws/members/:memberId` | `members:manage` | `{ role }` |
| POST | `/workspaces/:ws/leave` · `/workspaces/:ws/transfer` | member · `workspace:transfer` | transfer `{ memberId, password }` |
| GET | `/workspaces/:ws/audit?action&before` | `audit:read` | |
| GET | `/workspaces/:ws/billing` | `usage:read` | plan, credits, usage, limits, catalog |
| POST | `/workspaces/:ws/billing/checkout` · `/credits` · `/portal` | `billing:manage` (owner) | `{ plan: PRO\|AGENCY }` · `{ pack: "credits_500" }` → `{ url }` |
| GET / POST · PATCH · POST | `/workspaces/:ws/clients` · `/clients/:id` · `/clients/:id/share-team` | read / `clients:manage` | agency workspaces only |
| * | `/admin/overview`, `/admin/users[/:id]`, `/admin/workspaces[/:id/plan\|credits\|suspend]`, `/admin/ai[/pause\|/test]`, `/admin/signups`, `/admin/audit` | platform admin + 2FA (404 otherwise) | |

AI memory (learning from approvals): `GET /workspaces/:ws/ai-memory?businessId` (read) · `DELETE /workspaces/:ws/ai-memory?businessId`
and `DELETE /workspaces/:ws/ai-memory/:exampleId` (`business:update`) · `PUT /workspaces/:ws/ai-memory/settings { enabled }`
(`workspace:update`).

Public webhooks: `POST /api/v1/billing/webhook` (Stripe-Signature), `POST /api/v1/email/webhook` (Svix headers
from Resend). Errors: `PLAN_LIMIT_REACHED` (402), `USAGE_LIMIT_REACHED` (402, AI credits), `AI_PAUSED` (503),
`MFA_REQUIRED` (403 for admin pages). Sign-in returns `MFA_REQUIRED` / `MFA_INVALID` as the Auth.js error.

### Brand hub & assets (Phase 2)
| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/workspaces/:ws/businesses/:biz/brand` | `business:read` | `{ business, identity }` (approved, or null) |
| GET | `/workspaces/:ws/businesses/:biz/brand/logo?variant&theme&height&download=1` | `business:read` | approved logo SVG; 404 if none |
| GET / POST | `/workspaces/:ws/businesses/:biz/brand-assets` | `business:read` / `files:upload` | POST multipart: `file`, `name`, `kind`, `description?`; PNG/JPEG/GIF/WebP/PDF; 5 MB with database storage |
| DELETE | `/workspaces/:ws/businesses/:biz/brand-assets/:assetId` | `files:delete` | soft delete + bytes removed |
| GET | `/workspaces/:ws/files/:fileId/content?download=1` | `workspace:read` | S3 → 302 to signed URL; database → bytes (sandboxed CSP) |
| GET | `/fonts/:key/:weight` | public | bundled OFL fonts (`font/woff`, immutable cache) |

Context sections: `basics`, `offering`, `audience`, `goals`, `competitors`,
`brandIdentity`, `brandVoice`, `marketingPreferences`.

## Roles → permissions

`website:publish` (Phase 6): OWNER, ADMIN — publish/unpublish websites and manage custom domains.
`automation:approve`, `automation:manage` (Phase 8): OWNER, ADMIN. `automation:autopilot` (Phase 8): OWNER only.
`analytics:manage` (Phase 9): OWNER, ADMIN — tracking switches and data retention.
`clients:manage` (Phase 10): OWNER, ADMIN. `members:manage_admins`, `workspace:transfer` (Phase 10): OWNER only.

| Permission | VIEWER | EDITOR | ADMIN | OWNER |
|---|:-:|:-:|:-:|:-:|
| workspace:read, members:read, business:read | ✓ | ✓ | ✓ | ✓ |
| business:create/update, ai:generate, files:upload, usage:read | | ✓ | ✓ | ✓ |
| workspace:update, members:manage, business:delete, context:approve, files:delete, audit:read | | | ✓ | ✓ |
| workspace:delete, billing:manage | | | | ✓ |

## AI endpoints
There is no generic "generate anything" endpoint: each studio exposes task-specific endpoints (e.g.
Launch Studio section generation) that call the shared orchestrator with fixed instructions and schemas.
