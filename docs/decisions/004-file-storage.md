# ADR 004 — File storage abstraction (S3-compatible first)

**Options.** Cloudinary (image transforms/CDN, per-credit pricing, proprietary API) vs
S3-compatible object storage (AWS S3, Cloudflare R2 — no egress fees, Backblaze B2, MinIO for local).
**Decision.** A storage adapter interface (`put`, `delete`, `signedUrl`) with an S3-compatible
adapter (AWS SDK v3) as the default; private objects + signed URLs; workspace-prefixed keys;
magic-byte validation. A Cloudinary adapter can be added in Phase 2/5 if on-the-fly image
transforms are needed. No local-filesystem persistence (Vercel's FS is ephemeral).
**Consequences.** Provider choice (recommended: Cloudflare R2) and credentials are needed
before Phase 2. Until then uploads return `SERVICE_NOT_CONFIGURED`.
**Status.** Accepted (approved with Phase 0, 2026-11-24).

**Update (Phase 2, owner asked for free options).** Added a `database` adapter that stores bytes in MySQL
(`storage_objects`, ≤5 MB per file) and made it the default — free, no account, safe on serverless. The
S3-compatible adapter remains for scale; free S3-compatible tiers (Supabase Storage, Backblaze B2) need only
env vars. All adapters implement `put/get/delete/signedUrl`; files are served through an authenticated route.
