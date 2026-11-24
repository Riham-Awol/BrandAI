# ADR 002 — Authentication: Auth.js (NextAuth v4) instead of Clerk

**Context.** Need registration, login, logout, password recovery, sessions; users and
workspaces must live in our MySQL with workspace isolation; global audience; agencies later.

| | Clerk | Auth.js |
|---|---|---|
| Cost | Paid beyond free tier (per MAU) | Free, open source |
| Data location | Users stored at Clerk, synced via webhooks | Users in our MySQL |
| Password reset, MFA, orgs | Built in | Reset built by us; MFA/OAuth via providers later |
| Vendor lock-in | High | Low |
| Maintenance | Low | Medium (we own security code paths) |

Note: Auth.js v5 is still beta (5.0.0-beta.32); v4.24 is the `latest` stable tag and supports
the App Router and Next 16. The Auth.js project is now maintained alongside Better Auth.

**Decision.** Auth.js **v4.24 (stable)** with the Credentials provider and JWT sessions,
plus our own password-reset flow, lockout, rate limiting and DB re-validation of every
session (`session_version`). Rule 16 (no paid service without approval) also favours it.
**Consequences.** We own the reset/lockout code (covered by integration tests). OAuth
(Google/Microsoft) can be added as providers. MFA and email verification are future work.
If Clerk is preferred, only `src/server/auth/*` and the auth pages change.
**Status.** Proposed — awaiting approval.
