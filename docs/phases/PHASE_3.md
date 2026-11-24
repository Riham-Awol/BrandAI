# Phase 3 — AI Marketing Strategy Studio

Status: COMPLETE (awaiting approval)

## 1. Scope
- Eight AI sections on the shared studio engine: customer personas, competitor analysis (marketing view),
  marketing channels, campaign objectives (+ campaigns), budget, advertising strategy, KPIs, and the
  synthesized marketing strategy (positioning, messaging framework, funnel, 90-day plan, risks).
- Plan settings captured once: primary goal, monthly budget, currency (25 options), timeframe, focus markets,
  constraints. Business profile, brand identity and voice come from the approved context automatically.
- Budget maths computed by the app (totals, shares, first-year total, over-budget warning) — never trusted
  from AI output; amounts normalized; channels restricted to a fixed list.
- Review & approve → versioned `marketing_plans` + `marketingPreferences` context section.
- Exports: Markdown plan, budget CSV, KPI CSV (formula-injection safe), printable approved-plan page.
- Out of scope: live competitor/ads data, ad-platform integrations (Phase 8), analytics (Phase 9).

## 2. Database — migration `phase3_strategy_studio`
`ProjectType.STRATEGY_STUDIO`, `marketing_plans` (+ `MarketingPlanStatus`).

## 3. APIs — see API_DOCUMENTATION.md § Marketing Strategy Studio

## 4. UI
`/strategy`, `/strategy/new`, `/strategy/[projectId]`, `/businesses/[id]/marketing` (approved plan, print/exports).
Budget chart: single-series bars in a validated colour token (`--chart-bar`, light #7b5ea7 / dark #9d7ad9,
checked with the dataviz validator), values as text, hover/focus tooltip, full table as accessible view.

## 5. Acceptance criteria
- [x] Strategy project for an existing or new business; settings validated.
- [x] All 8 sections generate with structured output, using profile/brand context and earlier sections.
- [x] Personas, budget and all other sections viewable, editable (validated), regenerable, versioned, acceptable.
- [x] Budget totals/shares computed; over-budget warning; CSV export.
- [x] Approval versioned (admin/owner); publishes `marketingPreferences` without losing other context.
- [x] Markdown/CSV exports and printable approved plan.
- [x] Workspace isolation and role permissions tested; responsive + dark mode; regression passes.
