/**
 * End-to-end API surface test for the public `fakebase` package.
 *
 * Exercises every endpoint a consumer touches through `createClient` — the same
 * call shape as `@supabase/supabase-js` — proving the whole surface works when
 * wired through the headline entry point, not just per-package.
 */

import { describe, it, expect } from "vitest";
import { createClient, createMemoryKernel } from "../index.js";
import type { ProjectSchemaIR } from "@fakebase/core";

const schema: ProjectSchemaIR = {
  version: 1,
  enums: [],
  functions: [],
  tables: [
    {
      schema: "public",
      name: "todos",
      primaryKey: "id",
      rlsEnabled: false,
      policies: [],
      indexes: [],
      columns: [
        { name: "id", type: "uuid", nullable: false, primaryKey: true, defaultSql: "gen_random_uuid()" },
        { name: "title", type: "text", nullable: false },
        { name: "priority", type: "int4", nullable: false, defaultSql: "0" },
        { name: "done", type: "bool", nullable: false, defaultSql: "false" },
      ],
    },
    {
      schema: "public",
      name: "products",
      primaryKey: "id",
      rlsEnabled: false,
      policies: [],
      indexes: [],
      columns: [
        { name: "id", type: "uuid", nullable: false, primaryKey: true, defaultSql: "gen_random_uuid()" },
        { name: "name", type: "text", nullable: false },
        { name: "price", type: "int4", nullable: false, defaultSql: "0" },
      ],
    },
  ],
};

const newClient = () =>
  createClient("http://localhost", "service_role", { kernel: createMemoryKernel(schema) });

// ---------------------------------------------------------------------------
// Database — CRUD + filters
// ---------------------------------------------------------------------------

describe("database endpoints", () => {
  it("insert + select round-trips", async () => {
    const db = newClient();
    const ins = await db.from("todos").insert({ title: "a" }).select();
    expect(ins.error).toBeNull();
    const { data } = await db.from("todos").select("*");
    expect(data).toHaveLength(1);
  });

  it("filters with eq", async () => {
    const db = newClient();
    await db.from("todos").insert([{ title: "a", priority: 1 }, { title: "b", priority: 2 }]);
    const { data } = await db.from("todos").select("*").eq("priority", 2);
    expect(data).toHaveLength(1);
    expect((data as Array<{ title: string }>)[0]!.title).toBe("b");
  });

  it("orders and ranges (0-based inclusive)", async () => {
    const db = newClient();
    await db.from("todos").insert([
      { title: "a", priority: 3 },
      { title: "b", priority: 1 },
      { title: "c", priority: 2 },
    ]);
    const { data } = await db
      .from("todos")
      .select("*")
      .order("priority", { ascending: true })
      .range(0, 1);
    expect((data as Array<{ priority: number }>).map((r) => r.priority)).toEqual([1, 2]);
  });

  it("single() returns one row", async () => {
    const db = newClient();
    await db.from("todos").insert({ title: "solo" });
    const { data, error } = await db.from("todos").select("*").eq("title", "solo").single();
    expect(error).toBeNull();
    expect((data as { title: string }).title).toBe("solo");
  });

  it("update mutates matching rows", async () => {
    const db = newClient();
    await db.from("todos").insert({ title: "x", done: false });
    await db.from("todos").update({ done: true }).eq("title", "x");
    const { data } = await db.from("todos").select("done").eq("title", "x").single();
    expect((data as { done: boolean }).done).toBe(true);
  });

  it("delete removes matching rows", async () => {
    const db = newClient();
    await db.from("todos").insert({ title: "gone" });
    await db.from("todos").delete().eq("title", "gone");
    const { data } = await db.from("todos").select("*");
    expect(data).toHaveLength(0);
  });

  it("upsert inserts then updates by primary key", async () => {
    const db = newClient();
    const { data: created } = await db.from("todos").insert({ title: "v1" }).select().single();
    const id = (created as { id: string }).id;
    await db.from("todos").upsert({ id, title: "v2" });
    const { data } = await db.from("todos").select("title").eq("id", id).single();
    expect((data as { title: string }).title).toBe("v2");
  });
});

// ---------------------------------------------------------------------------
// Auth — full lifecycle
// ---------------------------------------------------------------------------

describe("auth endpoints", () => {
  it("signUp → signInWithPassword → getSession → signOut", async () => {
    const db = newClient();
    expect((await db.auth.signUp({ email: "a@b.com", password: "password123" })).error).toBeNull();

    const signIn = await db.auth.signInWithPassword({ email: "a@b.com", password: "password123" });
    expect(signIn.error).toBeNull();
    expect(signIn.data.user?.email).toBe("a@b.com");

    expect((await db.auth.getSession()).data.session).not.toBeNull();

    await db.auth.signOut();
    expect((await db.auth.getSession()).data.session).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Storage — buckets + objects
// ---------------------------------------------------------------------------

describe("storage endpoints", () => {
  it("createBucket → upload → download → getPublicUrl → list", async () => {
    const db = newClient();
    await db.storage.createBucket("docs", { public: true });

    const buckets = await db.storage.listBuckets();
    expect(buckets.data?.some((b) => b.id === "docs")).toBe(true);

    const up = await db.storage.from("docs").upload("hello.txt", "Hello, World!");
    expect(up.error).toBeNull();

    const dl = await db.storage.from("docs").download("hello.txt");
    expect(dl.error).toBeNull();
    expect(dl.data).toBeInstanceOf(Blob);

    const { data } = db.storage.from("docs").getPublicUrl("hello.txt");
    expect(data.publicUrl).toContain("hello.txt");
  });
});

// ---------------------------------------------------------------------------
// Realtime — postgres_changes
// ---------------------------------------------------------------------------

describe("realtime endpoints", () => {
  it("delivers INSERT events to a subscribed channel, then removes it", async () => {
    const db = newClient();
    const received: unknown[] = [];
    const ch = db
      .channel("products-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "products" }, (p) =>
        received.push(p),
      )
      .subscribe();

    await db.from("products").insert({ name: "Live Widget", price: 5 });
    expect(received).toHaveLength(1);

    expect(await db.removeChannel(ch)).toBe("ok");
    expect(db.getChannels()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Functions / RPC
// ---------------------------------------------------------------------------

describe("functions endpoints", () => {
  it("returns a structured error for an unknown function", async () => {
    const db = newClient();
    const { data, error } = await db.functions.invoke("nope");
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("invokes a registered function", async () => {
    const kernel = createMemoryKernel(schema);
    const db = createClient("http://localhost", "service_role", { kernel });
    (
      kernel.functions as {
        register: (name: string, handler: (opts: unknown) => Promise<unknown>) => void;
      }
    ).register("ping", async () => ({ pong: true }));
    const { data, error } = await db.functions.invoke("ping");
    expect(error).toBeNull();
    expect((data as { pong: boolean }).pong).toBe(true);
  });
});
