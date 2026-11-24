# Phase 5 — AI Creative Design Studio

Status: COMPLETE (awaiting approval)

## 1. Scope
- Design types: **poster, flyer, advertising graphic, banner, product graphic, event graphic, social media design**.
- Sizes per type (`src/modules/design/catalog.js`): A4 / A5 print (150 dpi artboards, PNG export at 300 dpi),
  square, portrait 4:5, story 1080×1920, landscape 1200×630, web banner 1500×500, display ads 300×250 and 728×90.
- **AI designs, code draws.** One AI call per brief returns **3 options**; each is a structured spec (template,
  colour scheme, eyebrow, headline, subheadline, body, bullets, badge, CTA, details, footer, icon, show logo).
  The server draws every option as vector SVG with the **approved brand identity** (logo, palette, heading/body
  fonts). Without an approved identity a neutral brand is used and the UI says so.
- **6 editable templates**: bold headline, split image, centered badge, minimal frame, diagonal band, event ticket.
  Very wide formats (aspect > 3:1, e.g. 728×90) use a single-row layout.
- Layout engine: grow-to-fill text sizing, word-safe wrapping (shrinks before breaking a word), optional items
  hidden with a visible warning when they cannot fit, readable text guaranteed (WCAG AA ≥ 4.5:1 on every
  scheme, even with weak brand colours).
- Photos: any image uploaded to the business's **brand assets** (PNG/JPEG/GIF/WebP ≤ 5 MB, magic-byte
  re-checked) can be placed; at least one option uses it. Without a photo the image panel is a tinted icon
  panel — never fake imagery.
- Editor: live server-rendered preview (the same renderer as the exports), text fields, template, colours,
  size (within the type), photo, icon, logo toggle; save creates a new **version**; restore any version;
  duplicate; delete.
- Exports: **SVG**, **PNG** (300 dpi for print sizes), **Print / Save as PDF** (A4/A5 page size).
- **"Design this post"** from the Social Media Studio post editor pre-fills the brief, size and CTA from the post.
- Out of scope: freehand canvas editing, AI image generation (no free provider; would need approval of a paid
  service), multi-page documents, stationery (Phase 7).

## 2. Safety
- The AI never produces markup: it returns validated data; text is converted to outlined paths with our own
  glyph layout; only the `<title>` holds text and it is XML-escaped (unit tested with script payloads).
- Icons are Lucide geometry from the curated list; unknown names are dropped.
- Images are embedded only as data URIs built from validated stored files of the same workspace **and business**.
- SVG responses use `default-src 'none'; img-src data:; sandbox`; previews are shown through `<img>`.

## 3. Database — migration `phase5_design_studio`
`designs` (current spec, format, kind, brief, image, source post, version, `is_mock`, soft delete) and
`design_revisions` (append-only spec/format/image per version). Enum `DesignKind`.

## 4. API
See docs/API_DOCUMENTATION.md § Creative Design Studio.

## 5. AI task
Module `design`, task `options` (`designOptionsSchema`). Input: brief, facts, CTA, optional social post, and
the approved business context (brand voice, audience, offer). The prompt forbids invented prices, dates,
discounts, reviews and statistics; facts are used only when the user typed them.

## 6. Acceptance criteria
- [x] Posters, flyers, ad graphics, banners, product, event and social designs in the right sizes.
- [x] Three AI options per brief, rendered with the approved logo, colours and fonts (neutral fallback).
- [x] Editable templates, text, colours, size, photo and icon with a live preview; versions and restore.
- [x] SVG, PNG (300 dpi print) and print/PDF exports.
- [x] Design a social post directly from the Social Media Studio.
- [x] Mock fixture registered and schema-valid; nothing saved until the user picks an option.
- [x] Workspace isolation, cross-business image access, viewer permissions tested; 390 px + dark mode; regression passes.

## 7. Tests
| Suite | New in Phase 5 |
|---|---|
| Unit (`tests/unit/design.test.js`) | catalog, schemas, fixture, normalization, text fitting, contrast, renderer (all templates × formats, safety, images, logo fallback, overflow) — 14 |
| Integration (`tests/integration/design-studio.test.js`) | generate (brand/neutral/sizes/images), save/edit/revisions/restore/duplicate/render/delete, social post pre-fill, isolation and viewer — 7 |
| E2E | full flow with exports; cross-workspace 404; mobile — 3 |
