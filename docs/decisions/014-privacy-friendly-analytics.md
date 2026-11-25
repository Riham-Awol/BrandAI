# ADR 014 — Privacy-friendly first-party analytics; AI explains, code computes

Status: Accepted (Phase 9)

## Context
Phase 9 needs website traffic, email engagement, social results, conversions and AI recommendations. Options were
a third-party analytics product (Google Analytics, Plausible: paid or cookie-based, extra infrastructure and
consent banners for every customer site), platform insights APIs (Meta/Instagram/LinkedIn need approved developer
apps — not available), or first-party counting.

## Decision
1. **First-party, cookieless page views.** Published sites render a 1×1 pixel
   (`/api/v1/sites/:site/px`). We store the page slug, a referrer host (or `utm:<source>`), a device class and a
   *daily-rotating* HMAC of (day, site, IP, user agent). No cookies, no IP, no cross-day or cross-site identifier.
   Bots, Do Not Track and Global Privacy Control browsers are skipped; each workspace can switch tracking off and
   choose a retention period (30–730 days; the scheduler purges older rows).
2. **Email opens/clicks** via an HMAC-signed per-delivery token. The click endpoint redirects only to the
   campaign's stored https link (never to a URL in the request). Only the first open and click per email are
   stored. Opens are labelled approximate. Workspaces can switch this off.
3. **Social results are entered by the team** from each platform's insights (`post_metrics`), until platform APIs
   are approved (Phase 10+).
4. **Numbers come from code, never from AI.** `metrics.js` computes every KPI (period vs previous period; money in
   BigInt minor units). The AI receives the formatted metrics and data gaps (plus approved business context) and
   returns structured insights that reference metric keys. `checkInsights` drops unknown keys, rewrites keys
   written in prose as plain names, and flags any number not traceable to the data as "unverified" in the UI.
   Each AI run is saved with its metrics snapshot so a report is reproducible.

## Consequences
- No new service, cost or consent banner for customer sites; data never leaves the database.
- Visitors are "unique per day, added up" (rotation prevents longer-range uniques) — stated in the UI.
- Sites served through a CDN cache would still count (the pixel is `no-store`).
- Ad-spend/ROAS and platform-native reach need platform integrations later.
