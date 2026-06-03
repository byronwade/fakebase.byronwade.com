/**
 * Storage client facade — wraps `kernel.storage` to expose the
 * `supabase.storage` surface (`from()`, `listBuckets()`, etc.).
 */
import type { FakebaseKernel, StorageEngine } from "@fakebase/core";
/** Return type of `createStorageClient`. */
export type StorageClientFacade = ReturnType<typeof createStorageClient>;
/**
 * Build the `supabase.storage` facade object.
 *
 * @param kernel - The kernel whose storage engine to wrap.
 */
export declare function createStorageClient(kernel: FakebaseKernel): StorageEngine;
//# sourceMappingURL=storage-client.d.ts.map