import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { LocalStorageService } from "../local-storage.js";
function makeStorage(rootDir) {
    const buckets = new Map();
    const objects = new Map();
    const signedUrls = new Map();
    const service = new LocalStorageService(rootDir, buckets, objects, signedUrls, {
        baseUrl: "http://localhost:54321/storage/v1",
    });
    return { service, buckets, objects, signedUrls };
}
describe("LocalStorageService", () => {
    let rootDir;
    beforeEach(() => {
        rootDir = join(tmpdir(), `fakebase-storage-test-${randomBytes(8).toString("hex")}`);
    });
    afterEach(async () => {
        if (existsSync(rootDir)) {
            await rm(rootDir, { recursive: true, force: true });
        }
    });
    describe("buckets", () => {
        it("creates a bucket and retrieves it", () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("photos", { public: true });
            const result = service.getBucket("photos");
            expect(result.error).toBeNull();
            expect(result.data?.id).toBe("photos");
            expect(result.data?.public).toBe(true);
        });
        it("lists all buckets", () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("bucket-a");
            service.createBucket("bucket-b");
            const result = service.listBuckets();
            expect(result.error).toBeNull();
            expect(result.data).toHaveLength(2);
            const names = result.data.map((b) => b.id);
            expect(names).toContain("bucket-a");
            expect(names).toContain("bucket-b");
        });
        it("rejects duplicate bucket creation", () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("dup");
            const second = service.createBucket("dup");
            expect(second.error).not.toBeNull();
            expect(second.error?.message).toContain("already exists");
        });
        it("updates bucket settings", () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("update-me", { public: false });
            service.updateBucket("update-me", { public: true, fileSizeLimit: 1024 * 1024 });
            const result = service.getBucket("update-me");
            expect(result.data?.public).toBe(true);
            expect(result.data?.fileSizeLimit).toBe(1024 * 1024);
        });
        it("deletes a bucket and removes its objects", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("to-delete");
            await service.from("to-delete").upload("file.txt", "hello");
            await service.deleteBucket("to-delete");
            const result = service.getBucket("to-delete");
            expect(result.error).not.toBeNull();
        });
        it("empties a bucket without deleting it", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("to-empty");
            await service.from("to-empty").upload("file1.txt", "data1");
            await service.from("to-empty").upload("file2.txt", "data2");
            await service.emptyBucket("to-empty");
            const listResult = service.from("to-empty").list();
            expect(listResult.data).toHaveLength(0);
            const bucketResult = service.getBucket("to-empty");
            expect(bucketResult.error).toBeNull();
        });
    });
    describe("upload and download", () => {
        it("uploads a string and downloads it", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("files");
            const uploadResult = await service
                .from("files")
                .upload("hello.txt", "Hello, World!", {
                contentType: "text/plain",
            });
            expect(uploadResult.error).toBeNull();
            expect(uploadResult.data?.path).toBe("hello.txt");
            const downloadResult = await service.from("files").download("hello.txt");
            expect(downloadResult.error).toBeNull();
            const text = await downloadResult.data.text();
            expect(text).toBe("Hello, World!");
        });
        it("uploads a Uint8Array and downloads it", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("binary");
            const bytes = new Uint8Array([1, 2, 3, 4, 5]);
            await service
                .from("binary")
                .upload("data.bin", bytes, { contentType: "application/octet-stream" });
            const result = await service.from("binary").download("data.bin");
            expect(result.error).toBeNull();
            const buf = await result.data.arrayBuffer();
            expect(new Uint8Array(buf)).toEqual(bytes);
        });
        it("rejects upload when file exists without upsert", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("no-upsert");
            await service.from("no-upsert").upload("file.txt", "first");
            const result = await service.from("no-upsert").upload("file.txt", "second");
            expect(result.error).not.toBeNull();
            expect(result.error?.message).toContain("already exists");
        });
        it("allows upsert to overwrite existing file", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("upsert-bucket");
            await service.from("upsert-bucket").upload("file.txt", "first");
            await service
                .from("upsert-bucket")
                .upload("file.txt", "second", { upsert: true });
            const result = await service.from("upsert-bucket").download("file.txt");
            const text = await result.data.text();
            expect(text).toBe("second");
        });
        it("returns error for non-existent download", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("dl-bucket");
            const result = await service.from("dl-bucket").download("missing.txt");
            expect(result.error).not.toBeNull();
        });
    });
    describe("getPublicUrl", () => {
        it("returns public URL for a file", () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("public-bucket", { public: true });
            const result = service.from("public-bucket").getPublicUrl("image.png");
            expect(result.data.publicUrl).toContain("public-bucket");
            expect(result.data.publicUrl).toContain("image.png");
        });
        it("returns public URL even when bucket is not public", () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("private-bucket", { public: false });
            const result = service.from("private-bucket").getPublicUrl("secret.pdf");
            expect(result.data.publicUrl).toContain("private-bucket");
            expect(result.data.publicUrl).toContain("secret.pdf");
        });
        it("includes transform parameters in URL", () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("img-bucket", { public: true });
            const result = service.from("img-bucket").getPublicUrl("photo.jpg", {
                transform: { width: 200, height: 200, resize: "cover" },
            });
            expect(result.data.publicUrl).toContain("width=200");
            expect(result.data.publicUrl).toContain("height=200");
            expect(result.data.publicUrl).toContain("resize=cover");
        });
    });
    describe("createSignedUrl", () => {
        it("creates a signed URL for a file", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("sign-bucket");
            await service.from("sign-bucket").upload("doc.pdf", "pdf content");
            const result = await service.from("sign-bucket").createSignedUrl("doc.pdf", 3600);
            expect(result.error).toBeNull();
            expect(result.data?.signedUrl).toContain("token=");
            expect(result.data?.token).toBeTruthy();
        });
        it("verifies a valid signed URL token", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("verify-bucket");
            const signResult = await service
                .from("verify-bucket")
                .createSignedUrl("file.txt", 3600);
            const token = signResult.data.token;
            const verified = service.verifySignedUrl(token);
            expect(verified).not.toBeNull();
            expect(verified?.bucketId).toBe("verify-bucket");
            expect(verified?.path).toBe("file.txt");
        });
        it("rejects expired signed URL", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("exp-bucket");
            const signResult = await service
                .from("exp-bucket")
                .createSignedUrl("file.txt", -1);
            const token = signResult.data.token;
            const verified = service.verifySignedUrl(token);
            expect(verified).toBeNull();
        });
        it("creates multiple signed URLs in batch", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("batch-bucket");
            const result = await service
                .from("batch-bucket")
                .createSignedUrls(["a.txt", "b.txt"], 3600);
            expect(result.error).toBeNull();
            expect(result.data).toHaveLength(2);
            expect(result.data[0].token).toBeTruthy();
            expect(result.data[1].token).toBeTruthy();
        });
    });
    describe("list", () => {
        it("lists all objects in a bucket", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("list-bucket");
            await service.from("list-bucket").upload("a.txt", "a");
            await service.from("list-bucket").upload("b.txt", "b");
            await service.from("list-bucket").upload("c.txt", "c");
            const result = service.from("list-bucket").list();
            expect(result.error).toBeNull();
            expect(result.data).toHaveLength(3);
        });
        it("lists objects with prefix", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("prefix-bucket");
            await service.from("prefix-bucket").upload("images/a.png", "img a");
            await service.from("prefix-bucket").upload("images/b.png", "img b");
            await service.from("prefix-bucket").upload("docs/readme.md", "docs");
            const result = service.from("prefix-bucket").list("images");
            expect(result.error).toBeNull();
            expect(result.data).toHaveLength(2);
            const names = result.data.map((e) => e.name);
            expect(names).toContain("a.png");
            expect(names).toContain("b.png");
        });
        it("returns folder entries for nested paths", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("folder-bucket");
            await service.from("folder-bucket").upload("folder/file.txt", "data");
            const result = service.from("folder-bucket").list();
            expect(result.error).toBeNull();
            expect(result.data).toHaveLength(1);
            const entry = result.data[0];
            expect(entry.name).toBe("folder");
            expect(entry.id).toBeNull();
        });
        it("limits results", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("limit-bucket");
            for (let i = 0; i < 10; i++) {
                await service.from("limit-bucket").upload(`file${i}.txt`, "x");
            }
            const result = service.from("limit-bucket").list(undefined, { limit: 3 });
            expect(result.data).toHaveLength(3);
        });
    });
    describe("remove", () => {
        it("removes specified files", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("remove-bucket");
            await service.from("remove-bucket").upload("file1.txt", "x");
            await service.from("remove-bucket").upload("file2.txt", "y");
            await service.from("remove-bucket").remove(["file1.txt"]);
            const result = service.from("remove-bucket").list();
            expect(result.data).toHaveLength(1);
            expect(result.data[0].name).toBe("file2.txt");
        });
        it("silently ignores non-existent paths", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("silent-bucket");
            const result = await service.from("silent-bucket").remove(["does-not-exist.txt"]);
            expect(result.error).toBeNull();
            expect(result.data).toHaveLength(0);
        });
    });
    describe("move", () => {
        it("moves a file to a new path", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("move-bucket");
            await service.from("move-bucket").upload("original.txt", "content");
            const result = await service
                .from("move-bucket")
                .move("original.txt", "moved.txt");
            expect(result.error).toBeNull();
            const info = service.from("move-bucket").info("moved.txt");
            expect(info.error).toBeNull();
            const missing = service.from("move-bucket").info("original.txt");
            expect(missing.error).not.toBeNull();
        });
        it("returns error when source does not exist", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("move-err-bucket");
            const result = await service.from("move-err-bucket").move("ghost.txt", "new.txt");
            expect(result.error).not.toBeNull();
        });
    });
    describe("copy", () => {
        it("copies a file to a new path", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("copy-bucket");
            await service.from("copy-bucket").upload("source.txt", "source content");
            const result = await service.from("copy-bucket").copy("source.txt", "copy.txt");
            expect(result.error).toBeNull();
            expect(result.data?.id).toBeTruthy();
            const originalDownload = await service.from("copy-bucket").download("source.txt");
            const copyDownload = await service.from("copy-bucket").download("copy.txt");
            const originalText = await originalDownload.data.text();
            const copyText = await copyDownload.data.text();
            expect(originalText).toBe("source content");
            expect(copyText).toBe("source content");
        });
    });
    describe("info", () => {
        it("returns metadata for an existing object", async () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("info-bucket");
            await service
                .from("info-bucket")
                .upload("info.txt", "hello", { contentType: "text/plain" });
            const result = service.from("info-bucket").info("info.txt");
            expect(result.error).toBeNull();
            expect(result.data?.name).toBe("info.txt");
            expect(result.data?.content_type).toBe("text/plain");
            expect(result.data?.size).toBe(5);
        });
        it("returns error for missing object", () => {
            const { service } = makeStorage(rootDir);
            service.createBucket("info-bucket2");
            const result = service.from("info-bucket2").info("missing.txt");
            expect(result.error).not.toBeNull();
        });
    });
});
//# sourceMappingURL=local-storage.test.js.map