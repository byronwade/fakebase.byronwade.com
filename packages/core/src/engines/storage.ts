/**
 * Storage engine contract and canonical value types.
 *
 * The concrete implementation lives in `@byronwade/storage` (`LocalStorageService`).
 * The kernel and client storage facade depend only on the types defined here.
 */

/** Result envelope returned by storage operations. */
export type StorageResult<T> =
  | { data: T; error: null }
  | { data: null; error: { message: string; statusCode?: string } };

/** A storage bucket record (shaped like `storage.buckets`). */
export interface BucketRecord {
  id: string;
  name: string;
  public: boolean;
  fileSizeLimit: number | null;
  allowedMimeTypes: string[] | null;
  createdAt: string;
  updatedAt: string;
}

/** A stored object's metadata (shaped like `storage.objects`). */
export interface ObjectRecord {
  id: string;
  bucket_id: string;
  name: string;
  owner?: string;
  size: number;
  content_type: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
}

/** A list entry that may also carry a joined bucket reference. */
export interface FileObject extends ObjectRecord {
  buckets?: BucketRecord;
}

/** A folder pseudo-entry returned by `list()` (metadata fields are null). */
export interface FolderEntry {
  name: string;
  id: string | null;
  updated_at: string | null;
  created_at: string | null;
  last_accessed_at: string | null;
  metadata: null;
}

export type ListEntry = FileObject | FolderEntry;

/** Image transform options (recorded; transforms are not applied locally). */
export interface TransformOptions {
  width?: number;
  height?: number;
  resize?: "cover" | "contain" | "fill";
  format?: "origin" | "avif" | "webp";
  quality?: number;
}

export interface CreateBucketOptions {
  public?: boolean;
  fileSizeLimit?: number | null;
  allowedMimeTypes?: string[] | null;
}

export interface UploadOptions {
  cacheControl?: string;
  contentType?: string;
  upsert?: boolean;
  duplex?: string;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  sortBy?: { column: string; order?: "asc" | "desc" };
  search?: string;
}

export interface GetPublicUrlOptions {
  transform?: TransformOptions;
  download?: boolean | string;
}

export interface CreateSignedUrlOptions {
  download?: boolean | string;
  transform?: TransformOptions;
}

/** The per-bucket object API returned by `storage.from(bucket)`. */
export interface StorageBucketApi {
  upload(
    path: string,
    body: Uint8Array | string | Blob,
    options?: UploadOptions,
  ): Promise<StorageResult<{ id: string; path: string; fullPath: string }>>;
  update(
    path: string,
    body: Uint8Array | string | Blob,
    options?: UploadOptions,
  ): Promise<StorageResult<{ id: string; path: string; fullPath: string }>>;
  move(
    fromPath: string,
    toPath: string,
    options?: { destinationBucket?: string },
  ): Promise<StorageResult<{ message: string }>>;
  copy(
    fromPath: string,
    toPath: string,
    options?: { destinationBucket?: string },
  ): Promise<StorageResult<{ id: string; path: string }>>;
  remove(paths: string[]): Promise<StorageResult<ObjectRecord[]>>;
  list(prefix?: string, options?: ListOptions): StorageResult<ListEntry[]>;
  download(
    path: string,
    options?: { transform?: TransformOptions },
  ): Promise<StorageResult<Blob>>;
  getPublicUrl(
    path: string,
    options?: GetPublicUrlOptions,
  ): { data: { publicUrl: string } };
  createSignedUrl(
    path: string,
    expiresIn: number,
    options?: CreateSignedUrlOptions,
  ): Promise<StorageResult<{ signedUrl: string; token: string; path: string }>>;
  createSignedUrls(
    paths: string[],
    expiresIn: number,
    options?: CreateSignedUrlOptions,
  ): Promise<
    StorageResult<
      Array<{ signedUrl: string; token: string; path: string; error: string | null }>
    >
  >;
  createSignedUploadUrl(
    path: string,
  ): Promise<StorageResult<{ signedUrl: string; token: string; path: string }>>;
  info(path: string): StorageResult<ObjectRecord>;
}

/** The storage engine contract consumed by the kernel and client facade. */
export interface StorageEngine {
  listBuckets(): StorageResult<BucketRecord[]>;
  createBucket(
    id: string,
    options?: CreateBucketOptions,
  ): StorageResult<{ name: string }>;
  getBucket(id: string): StorageResult<BucketRecord>;
  updateBucket(
    id: string,
    options: CreateBucketOptions,
  ): StorageResult<{ message: string }>;
  deleteBucket(id: string): Promise<StorageResult<{ message: string }>>;
  emptyBucket(id: string): Promise<StorageResult<{ message: string }>>;
  from(bucket: string): StorageBucketApi;
  verifySignedUrl(token: string): { bucketId: string; path: string } | null;
}
