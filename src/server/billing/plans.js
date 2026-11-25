/**
 * Plan catalog. Limits are enforced in code; prices shown in the app are
 * labels only: the amount actually charged is the Stripe Price configured by
 * the operator (STRIPE_PRICE_*), which must match these labels. Pure.
 */
const MB = 1024 * 1024;

export const PLANS = {
  FREE: {
    key: "FREE", name: "Free", priceLabel: "$0", interval: null,
    summary: "Try every studio with one business.",
    limits: { members: 2, businesses: 1, websites: 1, clients: 0, aiCredits: 100, storageBytes: 200 * MB, aiCostCapMicroUsd: 2_000_000 },
  },
  PRO: {
    key: "PRO", name: "Pro", priceLabel: "$19", interval: "month",
    summary: "For a growing business and its team.",
    limits: { members: 5, businesses: 5, websites: 5, clients: 0, aiCredits: 1000, storageBytes: 2048 * MB, aiCostCapMicroUsd: 20_000_000 },
  },
  AGENCY: {
    key: "AGENCY", name: "Agency", priceLabel: "$79", interval: "month",
    summary: "Run brands for your clients, each in their own workspace.",
    limits: { members: 15, businesses: 10, websites: 10, clients: 25, aiCredits: 5000, storageBytes: 10240 * MB, aiCostCapMicroUsd: 100_000_000 },
  },
};

export const PLAN_KEYS = Object.keys(PLANS);
export const PAID_PLANS = ["PRO", "AGENCY"];

/** One-time AI credit packs (never expire; used after the monthly allowance). */
export const CREDIT_PACKS = {
  credits_500: { key: "credits_500", credits: 500, priceLabel: "$10" },
};

export const RESOURCE_LABELS = { members: "team members", businesses: "businesses", websites: "websites", clients: "clients" };

/** Statuses that keep a paid plan's benefits (PAST_DUE keeps them while Stripe retries the payment). */
export function planInEffect(subscription) {
  if (!subscription) return "FREE";
  return ["ACTIVE", "TRIALING", "PAST_DUE"].includes(subscription.status) ? subscription.plan : "FREE";
}

/** The plan's limit for a resource, or the plan's allowance; Infinity when unlimited. */
export function limitFor(planKey, resource) {
  return PLANS[planKey]?.limits[resource] ?? 0;
}

/** True when adding `adding` more of a resource stays within the plan. */
export function withinLimit(planKey, resource, current, adding = 1) {
  return current + adding <= limitFor(planKey, resource);
}
