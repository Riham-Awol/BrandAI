import { PLANS } from "../billing/plans.js";

/**
 * Per-workspace limits applied at workspace creation: the Free plan's caps.
 * A plan change rewrites them (see src/server/billing/entitlements.js).
 */
const free = PLANS.FREE.limits;
export const DEFAULT_USAGE_LIMITS = [
  { metric: "AI_TEXT_REQUESTS", period: "MONTHLY", limitValue: BigInt(free.aiCredits) },
  { metric: "AI_IMAGE_REQUESTS", period: "MONTHLY", limitValue: 20n },
  { metric: "AI_COST_MICRO_USD", period: "MONTHLY", limitValue: BigInt(free.aiCostCapMicroUsd) },
  { metric: "STORAGE_BYTES", period: "MONTHLY", limitValue: BigInt(free.storageBytes) },
];
