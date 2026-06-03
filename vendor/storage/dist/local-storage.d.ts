import type { StorageEngine, StorageResult, StorageBucketApi, CreateBucketOptions, BucketRecord, ObjectRecord } from "@fakebase/core";
import type { SignedUrlRecord } from "./types.js";
export declare class LocalStorageService implements StorageEngine {
    private readonly rootDir;
    private readonly buckets;
    private readonly objects;
    private readonly signedUrls;
    private readonly baseUrl;
    constructor(rootDir: string, buckets: Map<string, BucketRecord>, objects: Map<string, ObjectRecord>, signedUrls: Map<string, SignedUrlRecord>, options?: {
        baseUrl?: string;
    });
    listBuckets(): StorageResult<BucketRecord[]>;
    createBucket(id: string, options?: CreateBucketOptions): StorageResult<{
        name: string;
    }>;
    getBucket(id: string): StorageResult<BucketRecord>;
    updateBucket(id: string, options: CreateBucketOptions): StorageResult<{
        message: string;
    }>;
    deleteBucket(id: string): Promise<StorageResult<{
        message: string;
    }>>;
    emptyBucket(id: string): Promise<StorageResult<{
        message: string;
    }>>;
    from(bucketId: string): StorageBucketApi;
    verifySignedUrl(token: string): {
        bucketId: string;
        path: string;
    } | null;
}
//# sourceMappingURL=local-storage.d.ts.map