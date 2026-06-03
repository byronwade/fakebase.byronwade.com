/** Real @supabase/supabase-js storage client against the Fakebase server. */
import { describe, it, expect, beforeEach } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createMemoryKernel } from "@byronwade/adapter-memory";
import type { ProjectSchemaIR } from "@byronwade/core";
import { createFakebaseServer, DEV_ANON_KEY } from "../index.js";

const schema: ProjectSchemaIR = { version: 1, enums: [], functions: [], tables: [] };

let supabase: SupabaseClient;

beforeEach(() => {
  const server = createFakebaseServer({ kernel: createMemoryKernel(schema) });
  supabase = createClient("http://localhost:54321", DEV_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        server.fetch(new Request(input as string, init)),
    },
  });
});

describe("real supabase-js storage against Fakebase server", () => {
  it("createBucket → listBuckets", async () => {
    const { error } = await supabase.storage.createBucket("docs", { public: true });
    expect(error).toBeNull();
    const { data } = await supabase.storage.listBuckets();
    expect(data?.some((b) => b.id === "docs")).toBe(true);
  });

  it("upload → download round-trips the bytes", async () => {
    await supabase.storage.createBucket("docs");
    const up = await supabase.storage.from("docs").upload("hello.txt", "Hello, Fakebase!");
    expect(up.error).toBeNull();

    const dl = await supabase.storage.from("docs").download("hello.txt");
    expect(dl.error).toBeNull();
    expect(await dl.data!.text()).toBe("Hello, Fakebase!");
  });

  it("list shows the uploaded object", async () => {
    await supabase.storage.createBucket("docs");
    await supabase.storage.from("docs").upload("a.txt", "a");
    const { data, error } = await supabase.storage.from("docs").list();
    expect(error).toBeNull();
    expect(data?.some((o) => o.name === "a.txt")).toBe(true);
  });

  it("remove deletes the object", async () => {
    await supabase.storage.createBucket("docs");
    await supabase.storage.from("docs").upload("gone.txt", "x");
    const { error } = await supabase.storage.from("docs").remove(["gone.txt"]);
    expect(error).toBeNull();
    const dl = await supabase.storage.from("docs").download("gone.txt");
    expect(dl.error).not.toBeNull();
  });

  it("createSignedUrl returns a signed URL string", async () => {
    await supabase.storage.createBucket("docs");
    await supabase.storage.from("docs").upload("s.txt", "s");
    const { data, error } = await supabase.storage.from("docs").createSignedUrl("s.txt", 60);
    expect(error).toBeNull();
    expect(typeof data?.signedUrl).toBe("string");
  });
});
