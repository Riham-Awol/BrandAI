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

Context sections: `basics`, `offering`, `audience`, `goals`, `competitors`,
`brandIdentity`, `brandVoice`, `marketingPreferences`.

## Roles → permissions
| Permission | VIEWER | EDITOR | ADMIN | OWNER |
|---|:-:|:-:|:-:|:-:|
| workspace:read, members:read, business:read | ✓ | ✓ | ✓ | ✓ |
| business:create/update, ai:generate, files:upload, usage:read | | ✓ | ✓ | ✓ |
| workspace:update, members:manage, business:delete, context:approve, files:delete, audit:read | | | ✓ | ✓ |
| workspace:delete, billing:manage | | | | ✓ |

## Not yet exposed
No public AI generation endpoint exists yet: each phase exposes task-specific
endpoints that call the shared orchestrator.
