/**
 * @byronwade/adapter-pglite
 *
 * PGlite (Postgres-in-WASM) adapter for Fakebase — the highest-fidelity local
 * backend. PGlite embeds a real Postgres engine compiled to WebAssembly, so you
 * get true Postgres semantics (parser, planner, `jsonb`, window functions, …)
 * with **no native build** — it runs identically on macOS, Linux, and Windows.
 *
 * ```ts
 * import { createPGliteKernel } from "@byronwade/adapter-pglite";
 * import { createClient } from "@byronwade/client";
 *
 * const kernel = createPGliteKernel({ schema, dataDir: ".fakebase/pg" });
 * const supabase = createClient(kernel);
 * ```
 *
 * Use `@byronwade/adapter-memory` (zero setup) for tests, or
 * `@byronwade/adapter-sqlite` for a durable file backend without WASM.
 */

export {
  PGliteAdapter,
  createPGliteKernel,
  type CreatePGliteKernelOptions,
} from "./pglite-adapter.js";
