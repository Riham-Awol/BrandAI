import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

const shared = {
  plugins: [react()],
  resolve: {
    alias: {
      "@": r("./src"),
      "server-only": r("./tests/stubs/server-only.js"),
    },
  },
};

export default defineConfig({
  ...shared,
  test: {
    projects: [
      {
        // Inline projects extend this config (plugins, aliases) in Vitest 5.
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.{js,jsx}"],
          setupFiles: ["tests/helpers/unit-setup.js"],
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.js"],
          globalSetup: ["tests/helpers/integration-global-setup.js"],
          setupFiles: ["tests/helpers/integration-env.js"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
