import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink, cp, rename, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
function ok(data) {
    return { data, error: null };
}
function makeError(message, statusCode) {
    return { data: null, error: { message, statusCode } };
}
function generateId() {
    return randomUUID();
}
function generateToken() {
    return randomBytes(32).toString("hex");
}
function now() {
    return new Date().toISOString();
}
function objectKey(bucketId, path) {
    return `${bucketId}/${path}`;
}
export class LocalStorageService {
    rootDir;
    buckets;
    objects;
    signedUrls;
    baseUrl;
    constructor(rootDir, buckets, objects, signedUrls, options) {
        this.rootDir = rootDir;
        this.buckets = buckets;
        this.objects = objects;
        this.signedUrls = signedUrls;
        this.baseUrl = options?.baseUrl ?? "http://localhost:54321/storage/v1";
    }
    listBuckets() {
        return ok(Array.from(this.buckets.values()));
    }
    createBucket(id, options = {}) {
        if (this.buckets.has(id)) {
            return makeError("Bucket already exists", "409");
        }
        const n = now();
        const bucket = {
            id,
            name: id,
            public: options.public ?? false,
            fileSizeLimit: options.fileSizeLimit ?? null,
            allowedMimeTypes: options.allowedMimeTypes ?? null,
            createdAt: n,
            updatedAt: n,
        };
        this.buckets.set(id, bucket);
        return ok({ name: id });
    }
    getBucket(id) {
        const bucket = this.buckets.get(id);
        if (!bucket)
            return makeError("Bucket not found", "404");
        return ok(bucket);
    }
    updateBucket(id, options) {
        const bucket = this.buckets.get(id);
        if (!bucket)
            return makeError("Bucket not found", "404");
        if (options.public !== undefined)
            bucket.public = options.public;
        if (options.fileSizeLimit !== undefined)
            bucket.fileSizeLimit = options.fileSizeLimit;
        if (options.allowedMimeTypes !== undefined)
            bucket.allowedMimeTypes = options.allowedMimeTypes;
        bucket.updatedAt = now();
        this.buckets.set(id, bucket);
        return ok({ message: "Successfully updated" });
    }
    async deleteBucket(id) {
        const bucket = this.buckets.get(id);
        if (!bucket)
            return makeError("Bucket not found", "404");
        await this.emptyBucket(id);
        this.buckets.delete(id);
        const bucketDir = join(this.rootDir, id);
        if (existsSync(bucketDir)) {
            await rm(bucketDir, { recursive: true, force: true });
        }
        return ok({ message: "Successfully deleted" });
    }
    async emptyBucket(id) {
        if (!this.buckets.has(id))
            return makeError("Bucket not found", "404");
        const toDelete = [];
        for (const [key, obj] of this.objects.entries()) {
            if (obj.bucket_id === id) {
                toDelete.push(key);
                const filePath = join(this.rootDir, id, obj.name);
                try {
                    await unlink(filePath);
                }
                catch {
                    // ignore missing files
                }
            }
        }
        for (const key of toDelete) {
            this.objects.delete(key);
        }
        return ok({ message: "Successfully emptied" });
    }
    from(bucketId) {
        const svc = this;
        return {
            async upload(path, body, options = {}) {
                const bucket = svc.buckets.get(bucketId);
                if (!bucket)
                    return makeError("Bucket not found", "404");
                const key = objectKey(bucketId, path);
                const existing = svc.objects.get(key);
                if (existing && !options.upsert) {
                    return makeError("The resource already exists", "409");
                }
                let bytes;
                if (typeof body === "string") {
                    bytes = Buffer.from(body, "utf8");
                }
                else if (body instanceof Blob) {
                    bytes = Buffer.from(await body.arrayBuffer());
                }
                else {
                    bytes = Buffer.from(body);
                }
                if (bucket.fileSizeLimit && bytes.length > bucket.fileSizeLimit) {
                    return makeError("File size limit exceeded", "413");
                }
                const filePath = join(svc.rootDir, bucketId, path);
                await mkdir(dirname(filePath), { recursive: true });
                await writeFile(filePath, bytes);
                const n = now();
                const objId = existing?.id ?? generateId();
                const obj = {
                    id: objId,
                    bucket_id: bucketId,
                    name: path,
                    size: bytes.length,
                    content_type: options.contentType ?? "application/octet-stream",
                    metadata: options.cacheControl
                        ? { cacheControl: options.cacheControl }
                        : null,
                    created_at: existing?.created_at ?? n,
                    updated_at: n,
                    last_accessed_at: null,
                };
                svc.objects.set(key, obj);
                return ok({ id: objId, path, fullPath: `${bucketId}/${path}` });
            },
            async update(path, body, options = {}) {
                const key = objectKey(bucketId, path);
                if (!svc.objects.has(key)) {
                    return makeError("Object not found", "404");
                }
                return this.upload(path, body, { ...options, upsert: true });
            },
            async move(fromPath, toPath, options) {
                const fromKey = objectKey(bucketId, fromPath);
                const existing = svc.objects.get(fromKey);
                if (!existing)
                    return makeError("Object not found", "404");
                const destBucketId = options?.destinationBucket ?? bucketId;
                if (!svc.buckets.has(destBucketId))
                    return makeError("Destination bucket not found", "404");
                const toKey = objectKey(destBucketId, toPath);
                const fromFile = join(svc.rootDir, bucketId, fromPath);
                const toFile = join(svc.rootDir, destBucketId, toPath);
                await mkdir(dirname(toFile), { recursive: true });
                await rename(fromFile, toFile);
                svc.objects.delete(fromKey);
                const n = now();
                svc.objects.set(toKey, {
                    ...existing,
                    bucket_id: destBucketId,
                    name: toPath,
                    updated_at: n,
                });
                return ok({ message: "Successfully moved" });
            },
            async copy(fromPath, toPath, options) {
                const fromKey = objectKey(bucketId, fromPath);
                const existing = svc.objects.get(fromKey);
                if (!existing)
                    return makeError("Object not found", "404");
                const destBucketId = options?.destinationBucket ?? bucketId;
                if (!svc.buckets.has(destBucketId))
                    return makeError("Destination bucket not found", "404");
                const toKey = objectKey(destBucketId, toPath);
                const fromFile = join(svc.rootDir, bucketId, fromPath);
                const toFile = join(svc.rootDir, destBucketId, toPath);
                await mkdir(dirname(toFile), { recursive: true });
                await cp(fromFile, toFile);
                const n = now();
                const newId = generateId();
                svc.objects.set(toKey, {
                    ...existing,
                    id: newId,
                    bucket_id: destBucketId,
                    name: toPath,
                    created_at: n,
                    updated_at: n,
                });
                return ok({ id: newId, path: toPath });
            },
            async remove(paths) {
                const removed = [];
                for (const path of paths) {
                    const key = objectKey(bucketId, path);
                    const obj = svc.objects.get(key);
                    if (!obj)
                        continue;
                    const filePath = join(svc.rootDir, bucketId, path);
                    try {
                        await unlink(filePath);
                    }
                    catch {
                        // ignore
                    }
                    svc.objects.delete(key);
                    removed.push(obj);
                }
                return ok(removed);
            },
            list(prefix, options = {}) {
                const { limit = 100, offset = 0, sortBy, search } = options;
                const normalizedPrefix = prefix
                    ? prefix.endsWith("/")
                        ? prefix
                        : `${prefix}/`
                    : "";
                const allEntries = new Map();
                for (const obj of svc.objects.values()) {
                    if (obj.bucket_id !== bucketId)
                        continue;
                    const name = obj.name;
                    if (normalizedPrefix && !name.startsWith(normalizedPrefix))
                        continue;
                    const relName = normalizedPrefix ? name.slice(normalizedPrefix.length) : name;
                    if (search && !relName.includes(search))
                        continue;
                    const slashIdx = relName.indexOf("/");
                    if (slashIdx !== -1) {
                        const folderName = relName.slice(0, slashIdx);
                        if (!allEntries.has(folderName)) {
                            allEntries.set(folderName, {
                                name: folderName,
                                id: null,
                                updated_at: null,
                                created_at: null,
                                last_accessed_at: null,
                                metadata: null,
                            });
                        }
                    }
                    else {
                        const fileObj = { ...obj, name: relName };
                        allEntries.set(relName, fileObj);
                    }
                }
                const entries = Array.from(allEntries.values());
                if (sortBy) {
                    entries.sort((a, b) => {
                        const col = sortBy.column;
                        const av = a[col] ?? "";
                        const bv = b[col] ?? "";
                        const cmp = av.localeCompare(bv);
                        return sortBy.order === "desc" ? -cmp : cmp;
                    });
                }
                return ok(entries.slice(offset, offset + limit));
            },
            async download(path, options) {
                void options;
                const key = objectKey(bucketId, path);
                const obj = svc.objects.get(key);
                if (!obj)
                    return makeError("Object not found", "404");
                const filePath = join(svc.rootDir, bucketId, path);
                try {
                    const bytes = await readFile(filePath);
                    const blob = new Blob([bytes], {
                        type: obj.content_type ?? "application/octet-stream",
                    });
                    obj.last_accessed_at = now();
                    svc.objects.set(key, obj);
                    return ok(blob);
                }
                catch {
                    return makeError("Object not found on disk", "404");
                }
            },
            getPublicUrl(path, options) {
                let url = `${svc.baseUrl}/object/public/${bucketId}/${path}`;
                const params = new URLSearchParams();
                if (options?.transform) {
                    const t = options.transform;
                    if (t.width)
                        params.set("width", String(t.width));
                    if (t.height)
                        params.set("height", String(t.height));
                    if (t.resize)
                        params.set("resize", t.resize);
                    if (t.format)
                        params.set("format", t.format);
                    if (t.quality)
                        params.set("quality", String(t.quality));
                }
                if (options?.download) {
                    params.set("download", typeof options.download === "string" ? options.download : "");
                }
                const qs = params.toString();
                if (qs)
                    url += `?${qs}`;
                return { data: { publicUrl: url } };
            },
            async createSignedUrl(path, expiresIn, options) {
                if (!svc.buckets.has(bucketId))
                    return makeError("Bucket not found", "404");
                const token = generateToken();
                const expiresAt = Date.now() + expiresIn * 1000;
                const record = {
                    token,
                    bucketId,
                    path,
                    expiresAt,
                    transformOptions: options?.transform,
                };
                svc.signedUrls.set(token, record);
                let signedUrl = `${svc.baseUrl}/object/sign/${bucketId}/${path}?token=${token}`;
                if (options?.download) {
                    signedUrl += `&download=${typeof options.download === "string" ? options.download : ""}`;
                }
                return ok({ signedUrl, token, path });
            },
            async createSignedUrls(paths, expiresIn, options) {
                const results = [];
                for (const path of paths) {
                    const r = await this.createSignedUrl(path, expiresIn, options);
                    if (r.error) {
                        results.push({ signedUrl: "", token: "", path, error: r.error.message });
                    }
                    else {
                        results.push({ ...r.data, error: null });
                    }
                }
                return ok(results);
            },
            async createSignedUploadUrl(path) {
                const token = generateToken();
                const expiresAt = Date.now() + 60 * 1000;
                const record = {
                    token,
                    bucketId,
                    path,
                    expiresAt,
                };
                svc.signedUrls.set(token, record);
                const signedUrl = `${svc.baseUrl}/object/upload/sign/${bucketId}/${path}?token=${token}`;
                return ok({ signedUrl, token, path });
            },
            info(path) {
                const key = objectKey(bucketId, path);
                const obj = svc.objects.get(key);
                if (!obj)
                    return makeError("Object not found", "404");
                return ok(obj);
            },
        };
    }
    verifySignedUrl(token) {
        const record = this.signedUrls.get(token);
        if (!record)
            return null;
        if (record.expiresAt < Date.now()) {
            this.signedUrls.delete(token);
            return null;
        }
        return { bucketId: record.bucketId, path: record.path };
    }
}
//# sourceMappingURL=local-storage.js.map