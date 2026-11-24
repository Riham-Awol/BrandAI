import { AppError } from "../../errors.js";
import { logger } from "../../logger.js";

/** Errors after which the next provider is tried (capacity, timeouts, rejected credentials, network). */
const TRY_NEXT_PROVIDER = new Set(["AI_MODEL_UNAVAILABLE", "AI_PROVIDER_BUSY", "AI_MODEL_TIMEOUT", "AI_PROVIDER_AUTH", "UPSTREAM_ERROR", "SERVICE_NOT_CONFIGURED"]);
// Whole chain must finish inside the AI routes' 300 s limit.
const TOTAL_BUDGET_MS = 230_000;
// The primary keeps most of the budget but leaves room for at least one fallback.
const PRIMARY_SHARE = 0.5;

/**
 * Chains text providers: the primary first, then each fallback (e.g. Gemini → OpenRouter
 * free models). Only the primary receives a requested model id. The result names the
 * provider that answered, so usage records stay accurate.
 */
export function createFallbackTextProvider(providers, { totalBudgetMs = TOTAL_BUDGET_MS } = {}) {
  const usable = providers.filter((p) => p.configured);
  const [primary] = providers;
  return {
    name: primary.name,
    configured: usable.length > 0,
    chain: providers.map((p) => p.name),
    async generate(request) {
      if (!usable.length) return primary.generate(request);
      const started = Date.now();
      let lastError;
      for (const [i, provider] of usable.entries()) {
        const remaining = totalBudgetMs - (Date.now() - started);
        if (lastError && remaining < 15_000) break;
        const isLast = i === usable.length - 1;
        const deadlineMs = isLast ? remaining : Math.round(remaining * PRIMARY_SHARE);
        try {
          const result = await provider.generate({ ...request, model: provider === primary ? request.model : undefined, deadlineMs });
          return { ...result, provider: provider.name };
        } catch (error) {
          if (!(error instanceof AppError && TRY_NEXT_PROVIDER.has(error.code)) || isLast) throw error;
          logger.warn("AI provider failed; trying the next free provider", { provider: provider.name, code: error.code });
          lastError = error;
        }
      }
      throw lastError;
    },
  };
}
