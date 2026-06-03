import { defineConfig } from "vitest/config";

/**
 * Aggregate coverage config across all packages (`pnpm test:coverage`).
 *
 * Deliberately named `vitest.coverage.config.ts` (not `vitest.config.ts`) so it
 * is NOT auto-discovered by each package's own `vitest run` — those use Vitest
 * defaults via Turbo. This file is only loaded explicitly via `-c`.
 */
export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts"],
    // PGlite boots a WASM Postgres per test; give the suite headroom.
    testTimeout: 20000,
    hookTimeout: 20000,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html", "lcov"],
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/__tests__/**", "**/dist/**", "**/index.ts"],
      // Floors sit just below current coverage to catch regressions without
      // being brittle. Raise them as coverage improves.
      thresholds: {
        lines: 52,
        statements: 52,
        functions: 65,
        branches: 65,
      },
    },
  },
});
