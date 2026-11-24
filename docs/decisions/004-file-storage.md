# ADR 004 — File storage abstraction (S3-compatible first)

**Options.** Cloudinary (image transforms/CDN, per-credit pricing, proprietary API) vs
S3-compatible object storage (AWS S3, Cloudflare R2 — no egress fees, Backblaze B2, MinIO for local).
**Decision.** A storage adapter interface (`put`, `delete`, `signedUrl`) with an S3-compatible
adapter (AWS SDK v3) as the default; private objects + signed URLs; workspace-prefixed keys;
magic-byte validation. A Cloudinary adapter can be added in Phase 2/5 if on-the-fly image
transforms are needed. No local-filesystem persistence (Vercel's FS is ephemeral).
**Consequences.** Provider choice (recommended: Cloudflare R2) and credentials are needed
before Phase 2. Until then uploads return `SERVICE_NOT_CONFIGURED`.
**Status.** Proposed — provider/account choice needs approval (paid service).
