/**
 * Default per-workspace limits applied at workspace creation. Subscription
 * plans (Phase 10) will replace these with plan-driven values.
 */
export const DEFAULT_USAGE_LIMITS = [
  { metric: "AI_TEXT_REQUESTS", period: "MONTHLY", limitValue: 200n },
  { metric: "AI_IMAGE_REQUESTS", period: "MONTHLY", limitValue: 20n },
  { metric: "AI_COST_MICRO_USD", period: "MONTHLY", limitValue: 5_000_000n }, // $5.00
  { metric: "STORAGE_BYTES", period: "MONTHLY", limitValue: 500n * 1024n * 1024n }, // 500 MB
];
