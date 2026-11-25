# Performance test (2026-11-25)

`scripts/load-test.mjs` (autocannon) against a production build on the 4-CPU build machine, with MySQL on the
same machine, 20 concurrent connections for 15 s per endpoint. Rate limits were raised for the test only
(`RATE_LIMIT_MULTIPLIER`, ignored in production).

| Endpoint | Requests/s | p50 | p97.5 | p99 | Errors / non-2xx |
|---|---:|---:|---:|---:|---:|
| Health check | 714 | 24 ms | 47 ms | 52 ms | 0 |
| Published website page (public) | 87 | 42 ms | 644 ms | 912 ms | 0 |
| Page-view pixel (public) | 287 | 68 ms | 99 ms | 139 ms | 0 |
| Analytics report API (signed in, 30 days) | 72 | 272 ms | 332 ms | 405 ms | 0 |
| Dashboard page (signed in) | 53 | 360 ms | 613 ms | 742 ms | 0 |
| Plan & usage API (signed in) | 144 | 133 ms | 190 ms | 215 ms | 0 |

A second run with a 15-connection database pool (default 5) gave the same throughput: the bottleneck is CPU
(Node rendering + MySQL on 4 cores), not database connections.

**Reading the numbers.** One small server handles thousands of daily users: e.g. 50 dashboard views/s ≈ 180,000
per hour. Public website pages have a slow tail (p99 ~0.9 s under saturation) because every request reads the
published snapshot from the database; a CDN cache or snapshot caching is the next step if sites get heavy
traffic. Scale out by running more app instances (stateless; sessions are cookies, rate limits in MySQL).

**Production settings.** `connection_limit=10` per instance (keep instances × limit below the database's
connection cap); `RATE_LIMIT_STORE=database` for multiple instances.
