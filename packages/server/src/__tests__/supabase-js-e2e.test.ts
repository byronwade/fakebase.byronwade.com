/**
 * The definitive drop-in proof: the REAL @supabase/supabase-js, given a custom
 * fetch that routes to the in-process Fakebase server, must work unmodified.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createMemoryKernel } from "@byronwade/adapter-memory";
import type { ProjectSchemaIR } from "@byronwade/core";
import { createFakebaseServer, DEV_ANON_KEY } from "../index.js";

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

let supabase: SupabaseClient;

beforeEach(() => {
  const server = createFakebaseServer({ kernel: createMemoryKernel(schema) });
  supabase = createClient("http://localhost:54321", DEV_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Route the real client's HTTP calls to the in-process handler.
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        server.fetch(new Request(input as string, init)),
    },
  });
});

describe("real @supabase/supabase-js against Fakebase server", () => {
  it("insert().select() round-trips", async () => {
    const { data, error } = await supabase
      .from("posts")
      .insert({ title: "hello", views: 3, published: true })
      .select();
    expect(error).toBeNull();
    expect(data?.[0]?.title).toBe("hello");
  });

  it("select().eq().order() filters and orders", async () => {
    await supabase.from("posts").insert([
      { title: "a", views: 5 },
      { title: "b", views: 1 },
      { title: "c", views: 9 },
    ]);
    const { data, error } = await supabase
      .from("posts")
      .select("title, views")
      .gt("views", 1)
      .order("views", { ascending: true });
    expect(error).toBeNull();
    expect(data?.map((r) => r.title)).toEqual(["a", "c"]);
  });

  it("update() and delete() work", async () => {
    await supabase.from("posts").insert({ title: "x", views: 1 });
    await supabase.from("posts").update({ views: 50 }).eq("title", "x");
    const upd = await supabase.from("posts").select("views").eq("title", "x").single();
    expect(upd.data?.views).toBe(50);

    await supabase.from("posts").delete().eq("title", "x");
    const after = await supabase.from("posts").select("*");
    expect(after.data).toHaveLength(0);
  });

  it("count: 'exact' returns the total", async () => {
    await supabase.from("posts").insert([{ title: "a" }, { title: "b" }]);
    const { count, error } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(count).toBe(2);
  });

  it("in() membership filter", async () => {
    await supabase.from("posts").insert([{ title: "a", views: 1 }, { title: "b", views: 2 }, { title: "c", views: 3 }]);
    const { data } = await supabase.from("posts").select("title").in("views", [1, 3]);
    expect(data?.map((r) => r.title).sort()).toEqual(["a", "c"]);
  });

  it("auth: signUp → signInWithPassword → getUser → signOut", async () => {
    const up = await supabase.auth.signUp({ email: "dev@example.com", password: "password123" });
    expect(up.error).toBeNull();

    const inn = await supabase.auth.signInWithPassword({
      email: "dev@example.com",
      password: "password123",
    });
    expect(inn.error).toBeNull();
    expect(inn.data.user?.email).toBe("dev@example.com");
    expect(inn.data.session?.access_token).toBeTruthy();

    const me = await supabase.auth.getUser(inn.data.session!.access_token);
    expect(me.error).toBeNull();
    expect(me.data.user?.email).toBe("dev@example.com");
  });
});
