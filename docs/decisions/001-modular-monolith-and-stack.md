# ADR 001 — Modular monolith on Next.js 16 (JavaScript)

**Context.** Ten product phases share auth, tenancy, business context, AI, storage and billing.
**Options.** (a) One app per phase; (b) microservices; (c) modular monolith.
**Decision.** (c). One Next.js App Router app, JavaScript/JSX only, shared services in
`src/server`, phase modules in `src/modules/<key>`. Next.js 16.4 defaults kept
(`cacheComponents`, `proxy.js` instead of `middleware.js`). `"type": "module"` in package.json.
**Consequences.** One deploy (Vercel) and one database; strict layering rules
(see SYSTEM_ARCHITECTURE.md) keep modules decoupled. Splitting out a service later is
possible because modules only depend on service interfaces.
