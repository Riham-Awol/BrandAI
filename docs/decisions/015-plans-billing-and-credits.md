# ADR 015 — Plans in code, Stripe as billing source of truth, AI credits

**Context.** Phase 10 needs subscription plans, payments and AI credit management. The owner chose Stripe (no
monthly fee; per-transaction fees; test mode free).

**Decision.**
- Plan limits live in code (`src/server/billing/plans.js`) and are enforced server-side (`assertPlanAllows`).
  Prices shown in the app are labels; the amount charged is the Stripe Price configured by the operator.
- Stripe Checkout + Customer Portal (no card data touches our servers). A signed webhook mirrors the subscription
  into `subscriptions`; events are processed once (`billing_events`) and retried by Stripe on errors. PAST_DUE keeps
  benefits while Stripe retries; CANCELED falls back to Free. Platform admins can assign plans (`source = ADMIN`)
  except for paying Stripe customers.
- No Stripe SDK: a small REST client with idempotency keys (fewer dependencies; testable with an injected fetch).
- AI credits: 1 credit = 1 AI request. The monthly allowance is the `AI_TEXT_REQUESTS` usage limit written from
  the plan; extra credits are a ledger (`ai_credit_entries`: purchases, admin grants, usage) used only after the
  allowance, charged after a successful request. Client workspaces of an agency count against the agency.

**Consequences.** Concurrent requests at the very edge of a limit can exceed it by a few credits (no global lock).
Changing plan prices means updating both Stripe and the labels.
