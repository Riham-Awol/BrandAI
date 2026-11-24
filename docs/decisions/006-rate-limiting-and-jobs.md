# ADR 006 — Rate limiting now, Redis/BullMQ later

**Context.** Serverless instances do not share memory, so in-memory rate limiting is ineffective
in production. Redis is "significant additional infrastructure" (needs approval) and no
long-running jobs exist yet.
**Decision.** Fixed-window counters in MySQL (`rate_limit_buckets`) via one atomic upsert
inside a transaction (verified with a concurrency test). Store is pluggable
(`memory` for single-process dev/e2e). Redis + BullMQ are introduced in Phase 8
(scheduling/automation), at which point the rate-limit store moves to Redis.
**Consequences.** One small DB write per rate-limited request (auth endpoints, API calls).
Client IP comes from `x-forwarded-for` / `x-real-ip`, which is trustworthy on Vercel;
behind other proxies ensure they overwrite these headers. Per-email limits on login do not depend on IP.
