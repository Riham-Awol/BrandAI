import "server-only";
import { getEnv } from "../../config/env.js";
import { Errors } from "../../errors.js";
import { createAnthropicTextProvider } from "./anthropic.js";
import { createMockImageProvider, createMockTextProvider } from "./mock.js";
import { mockFixtureResponder } from "./mock-fixtures.js";

/**
 * Provider registry. Modules never import a provider directly; they ask the
 * AI orchestrator, which asks this registry. Changing providers is a config
 * change (AI_TEXT_PROVIDER / AI_IMAGE_PROVIDER) plus one adapter file.
 *
 * Text and image generation are deliberately separate capabilities.
 */
let overrides = {};

export function getTextProvider() {
  if (overrides.text) return overrides.text;
  const env = getEnv();
  switch (env.AI_TEXT_PROVIDER) {
    case "anthropic":
      return createAnthropicTextProvider({ apiKey: env.ANTHROPIC_API_KEY, defaultModel: env.AI_TEXT_MODEL });
    case "mock":
      if (env.AI_ALLOW_MOCK !== "true") throw Errors.notConfigured("Mock AI (set AI_ALLOW_MOCK=true outside production)");
      return createMockTextProvider({ responder: mockFixtureResponder });
    default:
      throw Errors.notConfigured("AI text generation");
  }
}

/**
 * Image generation provider. No production image provider is selected yet:
 * the choice (and its cost) is made in Phase 2 (logo generation). Until then
 * calls fail with SERVICE_NOT_CONFIGURED instead of returning fake images.
 */
export function getImageProvider() {
  if (overrides.image) return overrides.image;
  const env = getEnv();
  if (env.AI_IMAGE_PROVIDER === "mock" && env.AI_ALLOW_MOCK === "true") return createMockImageProvider();
  return {
    name: "none",
    configured: false,
    async generate() {
      throw Errors.notConfigured("AI image generation");
    },
  };
}

/** Test hook: inject providers. */
export function setProviderOverrides(next) {
  overrides = next ?? {};
}
