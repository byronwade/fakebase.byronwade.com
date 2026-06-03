/**
 * Storage value types.
 *
 * The records and option types shared with the kernel/client live in
 * `@fakebase/core`; they are re-exported here. `SignedUrlRecord` is internal to
 * the local file engine and stays local.
 */
export type { BucketRecord, ObjectRecord, FileObject, FolderEntry, ListEntry, TransformOptions, CreateBucketOptions, UploadOptions, ListOptions, GetPublicUrlOptions, CreateSignedUrlOptions, StorageResult, StorageBucketApi, } from "@fakebase/core";
import type { TransformOptions } from "@fakebase/core";
/** Internal record tracking a generated signed URL/upload token. */
export interface SignedUrlRecord {
    token: string;
    bucketId: string;
    path: string;
    expiresAt: number;
    transformOptions?: TransformOptions;
}
//# sourceMappingURL=types.d.ts.map