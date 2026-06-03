/**
 * `createClient` — the primary entry point for application code.
 *
 * Drop-in replacement for `createClient` from `@supabase/supabase-js`:
 * ```diff
 * - import { createClient } from '@supabase/supabase-js';
 * + import { createClient } from 'fakebase';
 * ```
 */
import { DatabaseBuilder } from "./database-builder.js";
import { createAuthClient } from "./auth-client.js";
import { createStorageClient } from "./storage-client.js";
import { createRealtimeClient, } from "./realtime-client.js";
import { createFunctionsClient } from "./functions-client.js";
// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
/**
 * Create a new Fakebase client instance.
 *
 * The `url` and `key` parameters exist solely for API parity with
 * `@supabase/supabase-js` — they are intentionally ignored. All data
 * operations go through the `kernel` option.
 *
 * @param _url  - Ignored; present for API compatibility.
 * @param _key  - Ignored; present for API compatibility.
 * @param options - Client configuration, including the required `kernel`.
 *
 * @example
 * ```ts
 * import { createClient, createMemoryKernel } from 'fakebase';
 *
 * const kernel = createMemoryKernel({ tables: [], enums: [], functions: [], version: 0 });
 * const db = createClient<MyDatabase>('http://localhost', 'anon-key', { kernel });
 *
 * const { data, error } = await db.from('users').select('*').eq('role', 'admin');
 * ```
 */
export function createClient(_url, _key, options) {
    const { kernel, schema = "public" } = options;
    const authFacade = createAuthClient(kernel);
    const storageFacade = createStorageClient(kernel);
    const realtimeFacade = createRealtimeClient(kernel);
    const functionsFacade = createFunctionsClient(kernel);
    return {
        from(table) {
            return new DatabaseBuilder(kernel, table, schema);
        },
        schema(schemaName) {
            return {
                from(table) {
                    return new DatabaseBuilder(kernel, table, schemaName);
                },
            };
        },
        auth: authFacade,
        storage: storageFacade,
        realtime: realtimeFacade,
        functions: functionsFacade,
        channel: (name, opts) => realtimeFacade.channel(name, opts),
        removeChannel: (ch) => realtimeFacade.removeChannel(ch),
        removeAllChannels: () => realtimeFacade.removeAllChannels(),
        getChannels: () => realtimeFacade.getChannels(),
    };
}
//# sourceMappingURL=create-client.js.map