# ADR 013 — Permission-based automation and a MySQL scheduler

**Context.** Phase 8 adds outward actions (posting, emailing) that must follow explicit permissions, with
draft-only, approval-required and limited automation modes. ADR 006 anticipated Redis + BullMQ, which is new
infrastructure (and usually a paid host) requiring the owner's approval.

**Options.** Redis/BullMQ worker · hosted queue service · MySQL-backed scheduler triggered by any cron.

**Decision.**
- **Scheduler in MySQL**: due items are selected by `(status, scheduled_at)` index, claimed atomically
  (`updateMany … where status = APPROVED`), runs are serialized with a lease lock (`job_locks`), stale locks fail
  safely. Triggered by `POST /api/v1/cron/run` (Bearer `CRON_SECRET`) from any free scheduler, or "Run now".
  No new infrastructure. Redis/BullMQ can replace it later without API changes if volume requires.
- **Policy as a pure function** (`decidePublish`) evaluated at publish time with the current mode, human approval,
  channel state and daily limits; every decision is written to `automation_runs`.
- **Least privilege**: editors schedule, owners/admins approve and manage, only owners enable authorized automation.
- **Integrations**: encrypted credentials (AES-256-GCM, key from env), SSRF-guarded webhooks (connect-time DNS
  check), signed payloads; platforms needing app review are listed, not faked.

**Consequences.**
+ Works on any host with MySQL and a cron trigger; behaviour is testable in integration tests.
− Granularity equals the cron interval (5–15 min). − One runner at a time (fine for SMB volumes).
