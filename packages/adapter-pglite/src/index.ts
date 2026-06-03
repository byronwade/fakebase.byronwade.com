/**
 * @fakebase/adapter-pglite
 *
 * PGlite (Postgres-in-WASM) adapter for Fakebase — the highest-fidelity local
 * backend. PGlite embeds a real Postgres engine compiled to WebAssembly, so you
 * get true Postgres semantics (parser, planner, `jsonb`, window functions, …)
 * with **no native build** — it runs identically on macOS, Linux, and Windows.
 *
 * ```ts
 * import { createPGliteKernel } from "@fakebase/adapter-pglite";
 * import { createClient } from "@fakebase/client";
 *
 * const kernel = createPGliteKernel({ schema, dataDir: ".fakebase/pg" });
 * const supabase = createClient(kernel);
 * ```
 *
 * Use `@fakebase/adapter-memory` (zero setup) for tests, or
 * `@fakebase/adapter-sqlite` for a durable file backend without WASM.
 */

export {
  PGliteAdapter,
  createPGliteKernel,
  type CreatePGliteKernelOptions,
} from "./pglite-adapter.js";
