/**
 * Deterministic mock providers for automated tests and offline development.
 * They are refused in production (see config/env.js) and every result is
 * flagged `isMock: true` so mock output is never mistaken for real output.
 */
export function createMockTextProvider({ responder } = {}) {
  return {
    name: "mock",
    configured: true,
    isMock: true,
    async generate(request) {
      const result = responder ? await responder(request) : { text: "[mock output]", data: null };
      return {
        text: result.text ?? JSON.stringify(result.data ?? null),
        data: result.data ?? null,
        model: "mock",
        usage: { inputTokens: Math.ceil((request.prompt?.length ?? 0) / 4), outputTokens: 10 },
        raw: { isMock: true },
      };
    },
  };
}

export function createMockImageProvider() {
  return {
    name: "mock",
    configured: true,
    isMock: true,
    async generate({ prompt, count = 1 }) {
      return {
        images: Array.from({ length: count }, (_, i) => ({ mimeType: "image/svg+xml", data: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><title>mock ${i}: ${prompt.slice(0, 40).replace(/[<&>]/g, "")}</title></svg>`) })),
        model: "mock",
        usage: { imageCount: count },
      };
    },
  };
}
