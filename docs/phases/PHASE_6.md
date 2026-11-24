# Phase 6 — AI Website Builder

Status: COMPLETE (awaiting approval)

## 1. Scope
- Website types (`src/modules/website/catalog.js`): **business website** (home, about, services, contact),
  **landing page** (one page), **portfolio** (home, work, about, contact), **online store** (home, shop, about,
  contact). Three reusable styles: modern, classic, bold.
- **Content generation:** one AI call writes the whole site (pages → sections → copy, SEO titles/descriptions)
  from the approved business context and an optional brief; "Rewrite with AI" rewrites one section with
  instructions. Or **start from the template** (no AI) with placeholder text.
- **Controlled components, no executed AI code:** the AI returns structured data validated against
  `aiSiteSchema`; the app keeps only the planned pages and whitelisted section types (hero, features, about,
  services, products, portfolio, gallery, testimonials, FAQ, call to action, contact, text) and renders them
  with its own React components (`components/site/site-renderer.jsx`). Text is rendered as text; links must
  pass `isSafeLink` (internal pages, anchors, http(s), mailto, tel); icons come from the curated Lucide set.
- **Truthfulness:** real products/services from the business profile fill product/service cards (prices only
  when the owner entered them); the AI is told not to invent prices, contact details, hours, quantities or
  claims, and never writes testimonials (owners add real quotes). Because free models still sometimes add
  specifics, the editor shows "Check the facts before you publish" on unpublished AI sites.
- **Editor:** pages (add/remove, title, address, SEO), sections (add, reorder, delete, edit fields, photos from
  brand assets, rewrite with AI), site settings (style, tagline, announcement, footer, contact details, social
  links), name and address. **Live preview** with desktop/phone toggle uses the same components as the public
  site (container queries), with click-to-select sections. Drafts save with conflict detection (409).
- **Publishing:** publish snapshots the draft + brand (logo pre-rendered as vector) into an immutable version;
  the public site at `/sites/:slug` shows only the published version. Take offline, republish, copy any
  published version back into the draft. Publishing and domains need the new `website:publish` permission
  (owners and admins); editors can edit and save drafts.
- **E-commerce:** product catalogue with "Order / enquire" buttons that open the contact form with the product
  pre-selected; order enquiries arrive in the website's Messages inbox and as a notification. Card payments
  are out of scope (a payment provider is a paid service to be approved — Phase 10).
- **Forms:** the contact form works without JavaScript (plain POST), same-origin check, honeypot, per-IP rate
  limit (5 per 10 min), length limits; IPs are stored only as salted hashes.
- **Domain connection:** owner enters a domain → Brand AI shows a CNAME (to `SITES_CNAME_TARGET`, default the
  app host) and a TXT ownership record → "Check DNS" verifies the TXT record → the proxy serves the published
  site for that host. HTTPS certificates for custom domains are issued by the hosting platform (see Known
  limitations).

## 2. Database — migration `phase6_website_builder`
`websites` (draft `config` JSON, `draft_revision`, unique `slug`, status, published version pointer, unique
`custom_domain` + status/token), `website_versions` (immutable published snapshots incl. brand),
`website_submissions` (contact/order messages). Enums `WebsiteType`, `WebsiteStatus`, `DomainStatus`.

## 3. Acceptance criteria
- [x] Business, landing, portfolio and store websites; reusable types and styles; AI or template start.
- [x] AI writes structured content only; rendering uses whitelisted components; unsafe links rejected.
- [x] Editor with live desktop/phone preview, section management, photos, per-section AI rewrite.
- [x] Publish/unpublish with versions; public site serves the published snapshot only.
- [x] Working contact and order enquiry forms with an inbox and notifications.
- [x] Custom domain connection with DNS ownership verification and host-based routing.
- [x] Workspace isolation, viewer/editor/admin permissions, cross-business images rejected (tests).
- [x] Responsive (390 px) and dark mode for the editor; public sites responsive; regression passes.

## 4. Tests
| Suite | New in Phase 6 |
|---|---|
| Unit (`tests/unit/website.test.jsx`) | link safety, slugs, config building for every type, schema guards, image refs, forms, domains, proxy host rewrite, theme contrast (AA), font CSS safety, renderer (escaping, links, order flow, hidden empty sections) — 16 |
| Integration (`tests/integration/website-builder.test.js`) | AI/template creation, real products, drafts + conflicts, images, publish/snapshots/unpublish/restore, slugs, section rewrite, domains (DNS stub), messages + notifications, isolation and roles — 8 |
| E2E | full AI store flow → publish → visitor order enquiry → inbox → domain records → offline; cross-workspace 404; mobile editor + live site — 3 |
