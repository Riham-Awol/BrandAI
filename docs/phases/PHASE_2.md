# Phase 2 — AI Brand Identity Studio

Status: COMPLETE (awaiting approval)

## 1. Scope
**In scope** (all free — no paid service added):
- Brand personality, brand voice, taglines, colour palettes (with computed WCAG contrast), typography
  pairings, logo concepts and brand guidelines, each generated with structured output, versioned,
  editable, regenerable and acceptable (shared studio engine from Phase 1).
- "Pick one" selection for taglines, palettes, typography and logos.
- **Logo generation without an image model**: Claude designs structured logo specs (mark type, curated
  Lucide icon or monogram, container shape, curated open-source font, weight, case, tracking, colours);
  the server renders them as vector SVG with all text converted to outlines.
- Logo variations: horizontal, stacked, mark, wordmark × colour, mono, inverse. Logo editor with live preview.
- SVG and high-resolution PNG downloads (PNG rasterized in the browser).
- Review & approve: immutable, versioned brand identity; publishes `brandIdentity` and `brandVoice`
  into the central business context (other approved sections preserved).
- Brand hub per business (approved identity, logo files, colours, typography) and brand asset library
  (uploads stored in MySQL via the new free `database` storage adapter).
- Printable brand guidelines page (browser "Save as PDF").

**Out of scope:** raster/illustrative AI imagery (deferred; can use a free provider later), non-Latin
wordmarks, custom font uploads, PDF generation on the server.

## 2. Decisions (approved: "use something free")
See ADR 009 (structured vector logos) and ADR 004 (database storage adapter).

## 3. Database — migration `phase2_brand_studio`
`ProjectType.BRAND_STUDIO`, `brand_identities`, `brand_assets`, `storage_objects`.

## 4. APIs — see API_DOCUMENTATION.md § Brand Identity Studio

## 5. UI
`/brand`, `/brand/new`, `/brand/[projectId]`, `/businesses/[id]/brand` (hub + assets),
`/businesses/[id]/brand/guidelines`.

## 6. Acceptance criteria
- [x] Brand project created for an existing or new business in the active workspace.
- [x] All 7 sections generate with structured output; colours/icons/weights are normalized and validated.
- [x] Options can be selected; selections feed later sections and the identity.
- [x] Logos render as safe vector SVG in 4 layouts × 3 themes; logo can be customized with live preview.
- [x] SVG and PNG downloads work.
- [x] Identity approval is versioned, admin/owner only, and publishes brand context without losing profile sections.
- [x] Later AI calls receive the approved brand context.
- [x] Asset library uploads (PNG/JPEG/GIF/WebP/PDF ≤ 5 MB) stored in MySQL; SVG/HTML rejected.
- [x] Guidelines page renders from the approved identity and prints.
- [x] Workspace isolation and role permissions tested.
- [x] Responsive + dark mode; Phase 0/1 regression passes.

## 7. Test results
| Suite | Total | New in Phase 2 |
|---|---|---|
| Unit | 76 | 18 |
| Integration (MySQL) | 57 | 12 |
| End-to-end | 19 | 3 |
