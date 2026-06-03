/**
 * `fakebase` — the main entry point.
 *
 * Drop-in replacement for `@supabase/supabase-js`:
 * ```diff
 * - import { createClient } from '@supabase/supabase-js';
 * + import { createClient } from 'fakebase';
 * ```
 *
 * If you need an in-memory kernel (the default for local dev), import
 * `createMemoryKernel` and pass it as the `kernel` option:
 * ```ts
 * import { createClient, createMemoryKernel } from 'fakebase';
 * const kernel = createMemoryKernel({ tables: [], enums: [], functions: [], version: 0 });
 * const db = createClient<MyDatabase>('http://localhost', 'anon', { kernel });
 * ```
 */
export { createClient } from "@fakebase/client";
export { createMemoryKernel } from "@fakebase/adapter-memory";
export type { FakebaseClient, FakebaseClientOptions } from "@fakebase/client";
export type { FakebaseKernel, ProjectSchemaIR, TableIR, ColumnIR, } from "@fakebase/core";
export type { LocalSession, LocalUser, AuthStateChangeEvent } from "@fakebase/auth";
//# sourceMappingURL=index.d.ts.map