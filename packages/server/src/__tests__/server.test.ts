import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryKernel } from "@byronwade/adapter-memory";
import type { ProjectSchemaIR } from "@byronwade/core";
import { createFakebaseServer } from "../index.js";

const schema: ProjectSchemaIR = {
  version: 1,
  enums: [],
  functions: [],
  tables: [
    {
      schema: "public",
      name: "posts",
      primaryKey: "id",
      rlsEnabled: false,
      policies: [],
      indexes: [],
      columns: [
        { name: "id", type: "uuid", nullable: false, primaryKey: true, defaultSql: "gen_random_uuid()" },
        { name: "title", type: "text", nullable: false },
        { name: "views", type: "int4", nullable: false, defaultSql: "0" },
        { name: "published", type: "bool", nullable: false, defaultSql: "false" },
      ],
    },
  ],
};

let server: ReturnType<typeof createFakebaseServer>;
const base = "http://localhost:54321";

beforeEach(() => {
  server = createFakebaseServer({ kernel: createMemoryKernel(schema) });
});

const json = (path: string, init?: RequestInit) =>
  server.fetch(new Request(base + path, init));

describe("createFakebaseServer — /rest/v1", () => {
  it("inserts and returns the row with Prefer: return=representation", async () => {
    const res = await json("/rest/v1/posts", {
      method: "POST",
      headers: { "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify({ title: "hello", views: 3, published: true }),
    });
    expect(res.status).toBe(201);
    const rows = await res.json();
    expect(rows[0].title).toBe("hello");
  });

  it("selects rows", async () => {
    await json("/rest/v1/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([{ title: "a", views: 1 }, { title: "b", views: 2 }]),
    });
    const res = await json("/rest/v1/posts?select=*");
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(2);
  });

  it("filters with eq", async () => {
    await json("/rest/v1/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([{ title: "a", views: 1 }, { title: "b", views: 2 }]),
    });
    const res = await json("/rest/v1/posts?views=eq.2");
    const rows = await res.json();
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("b");
  });

  it("updates matching rows", async () => {
    await json("/rest/v1/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x", views: 1 }),
    });
    const res = await json("/rest/v1/posts?title=eq.x", {
      method: "PATCH",
      headers: { "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify({ views: 99 }),
    });
    expect((await res.json())[0].views).toBe(99);
  });

  it("deletes matching rows", async () => {
    await json("/rest/v1/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "gone", views: 1 }),
    });
    await json("/rest/v1/posts?title=eq.gone", { method: "DELETE" });
    expect(await (await json("/rest/v1/posts?select=*")).json()).toHaveLength(0);
  });

  it("returns a single object for Accept: application/vnd.pgrst.object+json", async () => {
    await json("/rest/v1/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "solo", views: 1 }),
    });
    const res = await json("/rest/v1/posts?title=eq.solo", {
      headers: { accept: "application/vnd.pgrst.object+json" },
    });
    expect(Array.isArray(await res.json())).toBe(false);
  });

  it("sets Content-Range when count=exact is requested", async () => {
    await json("/rest/v1/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([{ title: "a", views: 1 }, { title: "b", views: 2 }]),
    });
    const res = await json("/rest/v1/posts?select=*", { headers: { prefer: "count=exact" } });
    expect(res.headers.get("content-range")).toContain("/2");
  });
});

describe("createFakebaseServer — CORS + routing", () => {
  it("answers preflight OPTIONS with CORS headers", async () => {
    const res = await json("/rest/v1/posts", { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("404s an unknown route with a PostgREST error body", async () => {
    const res = await json("/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toHaveProperty("message");
  });
});
