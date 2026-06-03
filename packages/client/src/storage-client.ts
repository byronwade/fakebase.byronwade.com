/**
 * Storage client facade — wraps `kernel.storage` to expose the
 * `supabase.storage` surface (`from()`, `listBuckets()`, etc.).
 */

import type { FakebaseKernel, StorageEngine } from "@byronwade/core";

/** Return type of `createStorageClient`. */
export type StorageClientFacade = ReturnType<typeof createStorageClient>;

/**
 * Build the `supabase.storage` facade object.
 *
 * @param kernel - The kernel whose storage engine to wrap.
 */
export function createStorageClient(kernel: FakebaseKernel): StorageEngine {
  const storage = kernel.storage;

  return {
    listBuckets: () => storage.listBuckets(),
    createBucket: (id, options) => storage.createBucket(id, options),
    getBucket: (id) => storage.getBucket(id),
    updateBucket: (id, options) => storage.updateBucket(id, options),
    deleteBucket: (id) => storage.deleteBucket(id),
    emptyBucket: (id) => storage.emptyBucket(id),
    from: (bucket) => storage.from(bucket),
    verifySignedUrl: (token) => storage.verifySignedUrl(token),
  };
}
