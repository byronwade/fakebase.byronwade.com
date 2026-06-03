/**
 * @fakebase/seed — schema-driven fake data generation.
 *
 * Generate referentially-correct, deterministic fake data straight from the
 * schema IR. One engine, two entry points: `seedClient` (runtime auto-seed) and
 * `generateRows` (pure core, used by the CLI to write `supabase/seed.sql`).
 *
 * The leaf-value vocabulary is pluggable via {@link DataProvider}: the built-in
 * provider ships zero-dependency; install `@fakebase/seed-faker` to swap in
 * `@faker-js/faker` for richer data.
 */
export { generateRows } from "./generate.js";
export { seedClient } from "./seedClient.js";
export { createBuiltinProvider } from "./provider.js";
export { describeResolution } from "./report.js";
export { orderTables } from "./order.js";
export { createRng } from "./rng.js";
//# sourceMappingURL=index.js.map