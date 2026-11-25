# Phase 9 — Analytics & Business Intelligence

Status: COMPLETE (awaiting approval)

## 1. Scope
Everything lives under `/analytics`: **Overview**, **Post results**, **Saved reports**, **Tracking & privacy**, plus
a printable report (`/print/analytics/:id`). Main output: actionable business and marketing insights.

| Master-spec feature | Delivered as |
|---|---|
| Website traffic | Cookieless page-view pixel on published sites → visitors (unique per day), page views, top pages, sources (referrer host or `?utm_source=`), devices, daily chart |
| Conversions | Contact/order messages from published sites (`website_submissions`) and conversion rate (messages ÷ visitors) |
| Campaign analytics | Email campaigns: sent, failed, open rate (approximate), click rate, unsubscribes, per-campaign table |
| Social media analytics / engagement | Results entered per published post (reach, impressions, likes, comments, shares, saves, clicks) → reach, interactions, engagement rate, best posts |
| Performance reports | Every KPI against the previous period of the same length (7/30/90 days), filter by business; publishing reliability (published, on time, missed, failed, median time to approval); sales (paid invoices per currency, quotes and acceptance rate, overdue) |
| AI recommendations / business insights | "Get insights": AI reads the computed numbers + approved context → summary, highlights, prioritized recommendations, data gaps; each item cites metrics |
| Exportable reports | CSV and Markdown (live numbers or a saved report) and a printable A4 report ("Save as PDF") |

## 2. Trust rules
- **Numbers are computed in code** (`src/modules/analytics/metrics.js`, pure + unit-tested); money in BigInt minor
  units. The AI only explains them. Its output is checked (`checkInsights`): unknown metric keys are dropped, raw
  keys in prose become plain names, and any number that can't be traced to the data shows a "check this number"
  warning. Each run is saved with its metrics snapshot.
- **Data gaps are explicit** (no site, tracking off, no campaigns, development email provider, no post results,
  no invoices) so neither people nor the AI read missing data as bad results.
- **Privacy** (ADR 014): no cookies, no IP storage, daily-rotating visitor hash, bots and DNT/GPC skipped,
  per-workspace switches for site and email tracking, retention 30–730 days with automatic purge (scheduler).
- Email click redirects go only to the campaign's stored https link (signed token), so they can't be abused as an
  open redirect. Tracking endpoints are rate-limited and always answer the same way.

## 3. Permissions
Read: `business:read` (everyone). Enter post results, delete reports: `business:update` (editors+). Insights:
`ai:generate` (editors+). Tracking settings: new `analytics:manage` (admins, owner).

## 4. Data model
`site_views`, `email_events`, `post_metrics`, `analytics_reports`, `analytics_settings` (migration
`phase9_analytics`). See DATABASE_DESIGN.md.

## 5. Acceptance criteria
- [x] Real visits to a published site appear on the dashboard; bots, GPC browsers and unknown pages are not counted.
- [x] Email opens/clicks are recorded once per email; forged tokens are ignored; clicks only go to the stored link.
- [x] Results entered for a published post drive engagement metrics; viewers can't enter them; drafts are refused.
- [x] Every KPI shows the previous-period comparison; filters (period, business) scope the whole page.
- [x] AI insights are generated from computed metrics, saved, checked, and labelled when mock.
- [x] CSV, Markdown and print exports work; CSV is safe against formula injection.
- [x] Cross-workspace access to analytics, businesses, reports, post results → 404.
- [x] Charts: validated colours (light + dark), legend, crosshair tooltip with keyboard support, table view; works at 390 px and in dark mode.

## 6. Out of scope / later
Platform insights APIs (Meta, Instagram, LinkedIn, TikTok — need approved apps), ad spend / ROAS, email bounces and
complaints (need provider webhooks), scheduled report emails, custom date ranges.
