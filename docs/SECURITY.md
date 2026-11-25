# Security overview

How Brand AI addresses the OWASP Top 10 (2021) and the master-spec security requirements.

| Risk | Controls |
|---|---|
| **A01 Broken access control** | Every tenant service starts with `requireWorkspaceAccess(user, ws, PERMISSION)`; every query filters by workspace; other tenants' ids return 404. Role → permission map in one file (`roles.js`); owner-only actions (billing, ownership, admin roles). Client workspaces of agencies are separate workspaces (no shared data). Platform admin: re-checked from the database on every call, granted only from the command line, two-factor required, invisible (404) to others. Suspended accounts/workspaces are blocked server-side. |
| **A02 Cryptographic failures** | bcrypt (cost 12) passwords; SHA-256 hashes only for reset, verification and invitation tokens and recovery codes; AES-256-GCM for channel credentials and TOTP secrets; HSTS in production; secrets only in environment variables. |
| **A03 Injection** | Prisma parameterised queries (raw SQL only with tagged templates); Zod validation on every input; generated SVG built from validated data only; emails HTML-escaped; CSV export neutralises formulas. |
| **A04 Insecure design** | Permission-based automation (draft-only / approval / limited autopilot) re-checked at publish time; AI never computes business numbers; plan limits and AI credits enforced server-side. |
| **A05 Security misconfiguration** | Strict env validation at start (production refuses mock AI and console email); CSP (`default-src 'self'`, no plugins, no framing, forms to self), `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP; Docker image runs as non-root. |
| **A06 Vulnerable components** | `npm audit` monthly. Known: a ReDoS in `effect` used by the Prisma CLI config loader (build/migration tool, no user input) — fix requires a Prisma major downgrade, not applied. |
| **A07 Identification & authentication** | Rate-limited sign-in per IP and per account, lockout after 8 failures, TOTP two-factor with single-use recovery codes and replay protection, session revocation (password change, "sign out everywhere", suspension), email verification, enumeration-safe password reset. |
| **A08 Integrity failures** | Stripe and Resend webhooks verified by HMAC signature with a 5-minute window; Stripe events processed once (event-id table); outgoing webhooks signed. |
| **A09 Logging & monitoring** | Audit log for security, team, billing, admin and data actions (workspace view for admins, platform view for platform admins); structured server logs; `/api/v1/health`; AI failure-rate in `/admin`. |
| **A10 SSRF** | Outbound requests to user-supplied URLs only through `outboundFetch(..., { guard: true })` (public IPs only, DNS-rebinding-safe lookup); email click redirects only to the stored campaign link. |

Also: CSRF (SameSite cookies, JSON-only mutations, same-origin check), file uploads (magic-byte validation, size
limits, sandboxed serving), rate limits on every API, privacy-friendly analytics (no cookies, no IP storage,
DNT/GPC respected), retention purge.

**Reporting a vulnerability**: contact the operator's security email (set it in the site footer / `security.txt`).
