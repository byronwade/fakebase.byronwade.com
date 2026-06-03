/** /storage/v1/* — Supabase Storage REST subset (buckets + objects). */
import type { FakebaseKernel } from "@byronwade/core";
import { resolveRole, type AuthConfig } from "../context.js";
import { errorJson } from "../errors.js";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Split `bucket/path/to/file` into [bucket, "path/to/file"]. */
function splitBucketPath(rest: string): [string, string] {
  const slash = rest.indexOf("/");
  if (slash === -1) return [decodeURIComponent(rest), ""];
  return [decodeURIComponent(rest.slice(0, slash)), decodeURIComponent(rest.slice(slash + 1))];
}

export async function handleStorage(
  req: Request,
  url: URL,
  kernel: FakebaseKernel,
  auth: AuthConfig,
): Promise<Response> {
  kernel.setRole(resolveRole(req.headers, auth));
  const storage = kernel.storage;
  const path = url.pathname.replace(/^\/storage\/v1/, "");
  const method = req.method;

  // ── Buckets ────────────────────────────────────────────────────────────
  if (path === "/bucket" && method === "GET") {
    const r = storage.listBuckets();
    return r.error ? errorJson(400, r.error) : json(200, r.data);
  }
  if (path === "/bucket" && method === "POST") {
    const b = await readJson(req);
    const id = String(b.id ?? b.name);
    const r = storage.createBucket(id, { public: Boolean(b.public) });
    return r.error ? errorJson(400, r.error) : json(200, { name: id });
  }
  const bucketMatch = /^\/bucket\/([^/]+)(\/empty)?$/.exec(path);
  if (bucketMatch) {
    const id = decodeURIComponent(bucketMatch[1]!);
    if (bucketMatch[2] === "/empty" && method === "POST") {
      const r = await storage.emptyBucket(id);
      return r.error ? errorJson(400, r.error) : json(200, r.data);
    }
    if (method === "GET") {
      const r = storage.getBucket(id);
      return r.error ? errorJson(404, r.error) : json(200, r.data);
    }
    if (method === "PUT") {
      const b = await readJson(req);
      const r = storage.updateBucket(id, { public: Boolean(b.public) });
      return r.error ? errorJson(400, r.error) : json(200, r.data);
    }
    if (method === "DELETE") {
      const r = await storage.deleteBucket(id);
      return r.error ? errorJson(400, r.error) : json(200, r.data);
    }
  }

  // ── Objects ────────────────────────────────────────────────────────────
  if (path.startsWith("/object/list/") && method === "POST") {
    const bucket = decodeURIComponent(path.slice("/object/list/".length));
    const b = await readJson(req);
    const r = storage.from(bucket).list(String(b.prefix ?? ""), b as never);
    return r.error ? errorJson(400, r.error) : json(200, r.data);
  }
  if (path.startsWith("/object/sign/") && method === "POST") {
    const [bucket, objectPath] = splitBucketPath(path.slice("/object/sign/".length));
    const b = await readJson(req);
    const r = await storage.from(bucket).createSignedUrl(objectPath, Number(b.expiresIn ?? 3600));
    return r.error ? errorJson(400, r.error) : json(200, r.data);
  }
  if (
    (path.startsWith("/object/public/") || path.startsWith("/object/authenticated/")) &&
    method === "GET"
  ) {
    const prefix = path.startsWith("/object/public/")
      ? "/object/public/"
      : "/object/authenticated/";
    const [bucket, objectPath] = splitBucketPath(path.slice(prefix.length));
    const r = await storage.from(bucket).download(objectPath);
    if (r.error || !r.data) return errorJson(404, r.error ?? { message: "Object not found" });
    return new Response(await r.data.arrayBuffer(), {
      status: 200,
      headers: { "content-type": r.data.type || "application/octet-stream" },
    });
  }
  // DELETE /object/:bucket  (body: { prefixes: string[] })
  const bucketOnly = /^\/object\/([^/]+)$/.exec(path);
  if (bucketOnly && method === "DELETE") {
    const bucket = decodeURIComponent(bucketOnly[1]!);
    const b = await readJson(req);
    const r = await storage.from(bucket).remove((b.prefixes as string[]) ?? []);
    return r.error ? errorJson(400, r.error) : json(200, r.data);
  }
  // /object/:bucket/:path — upload / update / download
  if (path.startsWith("/object/")) {
    const [bucket, objectPath] = splitBucketPath(path.slice("/object/".length));
    if (method === "POST" || method === "PUT") {
      const bytes = new Uint8Array(await req.arrayBuffer());
      const contentType = req.headers.get("content-type") ?? "application/octet-stream";
      const upsert = req.headers.get("x-upsert") === "true" || method === "PUT";
      const api = storage.from(bucket);
      const r = await (method === "PUT"
        ? api.update(objectPath, bytes, { contentType })
        : api.upload(objectPath, bytes, { contentType, upsert }));
      return r.error
        ? errorJson(400, r.error)
        : json(200, { Key: `${bucket}/${objectPath}`, ...r.data });
    }
    if (method === "GET") {
      const r = await storage.from(bucket).download(objectPath);
      if (r.error || !r.data) return errorJson(404, r.error ?? { message: "Object not found" });
      return new Response(await r.data.arrayBuffer(), {
        status: 200,
        headers: { "content-type": r.data.type || "application/octet-stream" },
      });
    }
  }

  return errorJson(404, { message: `No storage route: ${method} ${path}` });
}
