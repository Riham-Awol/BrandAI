# ADR 003 — MySQL 8 + Prisma 7 (driver adapter)

**Context.** Spec requires MySQL 8 + Prisma migrations, JavaScript only.
**Findings.** Prisma 7.10 is the latest stable line (8.0 is still RC). Prisma 7 requires a
driver adapter at runtime and a `prisma.config.*` file for the CLI. Its new `prisma-client`
generator emits TypeScript, so we keep the still-supported **`prisma-client-js`** generator.
**Decision.** Prisma 7.10.1, `prisma-client-js`, `@prisma/adapter-mariadb` (Prisma's MySQL
adapter), `prisma.config.mjs`. UUID `CHAR(36)` ids, money in integer micro-units.
**Consequences.** Works on Vercel serverless (pure JS driver). Managed MySQL options
(PlanetScale, Aiven, DigitalOcean, AWS RDS) need only `DATABASE_URL` (+ `sslaccept=strict`).
`npm audit` flags a ReDoS in `effect` used by the Prisma CLI config loader (build-time only,
no user input); the only fix offered is downgrading to Prisma 6.12 — not taken. Re-check on upgrade.
