# Phase 10 — SaaS Administration & Production Launch

Status: COMPLETE (awaiting approval)

## 1. Scope
| Master-spec feature | Delivered as |
|---|---|
| Team management | Settings → Team: members, email invitations (7-day, single-use, email must match), roles, remove, leave, ownership transfer (password) |
| Roles and permissions | Owner / Admin / Editor / Viewer, now with owner-only `members:manage_admins`, `workspace:transfer`, `billing:manage`; role guide in the UI |
| Agency workspaces & client management | Agency workspace type; Settings → Clients: each client gets its own isolated workspace using the agency's plan and AI credits; status (active/paused/archived), contact, notes, "give my team access", open workspace |
| Subscription plans | Free / Pro ($19) / Agency ($79) with limits on members, businesses, websites, clients, AI credits, storage, AI cost cap |
| Payment integrations | Stripe Checkout (plans, credit packs), Customer Portal, signed idempotent webhook keeping plans in sync; cancellation on workspace/account deletion |
| AI credit management | Monthly allowance per plan (agency clients share the agency's), purchasable extra credits that don't expire, ledger, admin grants |
| AI provider administration | `/admin/ai`: provider/fallback configuration (key presence only), 7-day health per provider, live test request, platform-wide **Pause AI** with message |
| Usage monitoring | Settings → Plan & usage (meters for credits, seats, businesses, websites, clients, storage, AI cost); `/admin` overview (accounts, workspaces, MRR, paid plans, AI requests/failure rate/cost by model) |
| Platform administration | `/admin` (platform admins only, two-factor required): users (search, suspend/restore), workspaces (plan, credits, suspend), sign-ups open/closed, audit |
| Audit logs | Settings → Audit log (workspace, admins/owner) and `/admin/audit` (platform, filters) |
| Security hardening | Two-factor sign-in (TOTP + recovery codes), email verification, change password / sign out everywhere / delete account, account & workspace suspension, CSP + COOP, webhook signatures, see [SECURITY.md](../SECURITY.md) |
| Performance testing | `scripts/load-test.mjs`, results in [PERFORMANCE.md](../PERFORMANCE.md) |
| Backups | `scripts/backup-db.sh` / `restore-db.sh` (verified), compose `backup` service, [OPERATIONS.md](../OPERATIONS.md) |
| Production deployment | `Dockerfile`, `docker-compose.yml` (app, MySQL, scheduler, backups), CI image build, [DEPLOYMENT.md](../DEPLOYMENT.md) (Vercel + TiDB free path, or one server) |
| Technical documentation | DEPLOYMENT, OPERATIONS, SECURITY, PERFORMANCE, API, DATABASE, ADR 015–016 |

Earlier-phase gaps also closed: account settings page, email bounce/complaint handling (Resend webhook →
contacts suppressed, shown in Audience).

## 2. Acceptance criteria
- [x] Invitations: only the invited address accepts, once; seats enforced by plan; owner-only admin roles; transfer.
- [x] Plans enforced server-side (members, businesses, websites, clients); downgrade keeps data, blocks new items.
- [x] Stripe checkout → webhook → plan + limits; replayed/forged/stale events rejected; credit packs credited once.
- [x] AI credits: allowance, then extra credits, then a clear limit; agency clients draw on the agency pool.
- [x] Agency clients isolated from each other and from other agencies; archived clients closed.
- [x] Platform admin invisible to others, requires 2FA, all actions audited; AI pause blocks generation.
- [x] Two-factor sign-in with replay protection and single-use recovery codes; sign out everywhere.
- [x] Backup/restore verified; Docker image builds, migrates and passes its health check.
