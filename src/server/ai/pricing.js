/**
 * Model price table used for cost estimates (USD per 1M tokens).
 * Source: Anthropic published pricing (cached 2026-11). Verify against the
 * provider's pricing page when updating; estimates are not invoices.
 * Cost is stored in micro-USD: USD-per-MTok × tokens = micro-USD.
 */
export const TEXT_MODEL_PRICES = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-opus-4-8": { input: 5, output: 25 },
  mock: { input: 0, output: 0 },
};

const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

export function estimateTextCostMicroUsd(model, usage) {
  const price = TEXT_MODEL_PRICES[model];
  if (!price) return 0n;
  const input =
    (usage.inputTokens ?? 0) * price.input +
    (usage.cacheWriteTokens ?? 0) * price.input * CACHE_WRITE_MULTIPLIER +
    (usage.cacheReadTokens ?? 0) * price.input * CACHE_READ_MULTIPLIER;
  const output = (usage.outputTokens ?? 0) * price.output;
  return BigInt(Math.ceil(input + output));
}

export function isKnownTextModel(model) {
  return Object.hasOwn(TEXT_MODEL_PRICES, model);
}
