import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Expected failures (a provider retry, a seed fallback) stay out of the test output.
    env: { LOG_LEVEL: "error" },
    // CI also writes JUnit XML for the run's test summary (docs/QA.md).
    reporters: process.env.CI ? ["default", "junit"] : ["default"],
    outputFile: { junit: "reports/junit/unit.xml" },
  },
});
