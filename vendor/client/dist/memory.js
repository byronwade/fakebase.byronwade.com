/**
 * Synchronous factory for creating a memory-backed kernel handle.
 *
 * The initialization is async (MemoryAdapter.initialize), but this
 * function returns synchronously. Queries are automatically deferred
 * until initialization completes.
 */
import { MemoryAdapter } from "@fakebase/adapter-memory";
import { FakebaseKernel } from "@fakebase/core";
/**
 * Create a zero-setup in-memory kernel handle.
 *
 * Returns synchronously. The underlying initialization completes asynchronously,
 * but all queries automatically wait for it via the internal `_adapter` promise.
 *
 * ```ts
 * const { kernel } = createMemoryKernel<Database>();
 * const supabase = createClient<Database>("local", "dev-key", { kernel });
 * ```
 */
export function createMemoryKernel(opts = {}) {
    const adapter = new MemoryAdapter();
    const fakebaseKernel = new FakebaseKernel({ adapter, schema: opts.schema });
    // Initialize asynchronously — queries wait on this promise
    const initPromise = fakebaseKernel.initialize().then(() => adapter);
    const kernel = {
        _adapter: initPromise,
    };
    return { kernel };
}
//# sourceMappingURL=memory.js.map