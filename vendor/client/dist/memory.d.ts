/**
 * Synchronous factory for creating a memory-backed kernel handle.
 *
 * The initialization is async (MemoryAdapter.initialize), but this
 * function returns synchronously. Queries are automatically deferred
 * until initialization completes.
 */
import type { ProjectSchemaIR } from "@fakebase/core";
import type { KernelHandle } from "./client.js";
export interface MemoryKernelOptions {
    schema?: ProjectSchemaIR;
}
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
export declare function createMemoryKernel<_Database = unknown>(opts?: MemoryKernelOptions): {
    kernel: KernelHandle;
};
//# sourceMappingURL=memory.d.ts.map