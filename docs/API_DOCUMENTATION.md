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

Context sections: `basics`, `offering`, `audience`, `goals`, `competitors`,
`brandIdentity`, `brandVoice`, `marketingPreferences`.

## Roles → permissions
| Permission | VIEWER | EDITOR | ADMIN | OWNER |
|---|:-:|:-:|:-:|:-:|
| workspace:read, members:read, business:read | ✓ | ✓ | ✓ | ✓ |
| business:create/update, ai:generate, files:upload, usage:read | | ✓ | ✓ | ✓ |
| workspace:update, members:manage, business:delete, context:approve, files:delete, audit:read | | | ✓ | ✓ |
| workspace:delete, billing:manage | | | | ✓ |

## AI endpoints
There is no generic "generate anything" endpoint: each studio exposes task-specific endpoints (e.g.
Launch Studio section generation) that call the shared orchestrator with fixed instructions and schemas.
