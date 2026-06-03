import { describe, it, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createMemoryKernel } from "@byronwade/adapter-memory";
import type { ProjectSchemaIR } from "@byronwade/core";
import { parseSelect } from "../rest/embed.js";
import { createFakebaseServer, DEV_ANON_KEY } from "../index.js";

describe("parseSelect", () => {
  it("separates base columns from embedded resources", () => {
    expect(parseSelect("title, users(name,email)")).toEqual({
      columns: ["title"],
      embeds: [{ name: "users", columns: ["name", "email"] }],
    });
  });
  it("treats * as all base columns and resolves embed *", () => {
    expect(parseSelect("*, posts(*)")).toEqual({
      columns: undefined,
      embeds: [{ name: "posts", columns: undefined }],
    });
  });
});

const schema: ProjectSchemaIR = {
  version: 1,
  enums: [],
  functions: [],
  tables: [
    {
      schema: "public",
      name: "users",
      primaryKey: "id",
      rlsEnabled: false,
      policies: [],
      indexes: [],
      columns: [
        { name: "id", type: "uuid", nullable: false, primaryKey: true, defaultSql: "gen_random_uuid()" },
        { name: "name", type: "text", nullable: false },
      ],
    },
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
        { name: "author_id", type: "uuid", nullable: false, references: { table: "users", column: "id" } },
      ],
    },
  ],
};

function client(): SupabaseClient {
  const server = createFakebaseServer({ kernel: createMemoryKernel(schema) });
  return createClient("http://localhost:54321", DEV_ANON_KEY, {
    auth: { persistSession: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        server.fetch(new Request(input as string, init)),
    },
  });
}

describe("real supabase-js embedded selects", () => {
  it("forward embed (many-to-one) nests a single related object", async () => {
    const s = client();
    const { data: u } = await s.from("users").insert({ name: "Ada" }).select().single();
    await s.from("posts").insert([{ title: "p1", author_id: u!.id }]);
    const { data, error } = await s.from("posts").select("title, users(name)");
    expect(error).toBeNull();
    expect(data?.[0]).toEqual({ title: "p1", users: { name: "Ada" } });
  });

  it("reverse embed (one-to-many) nests an array of related rows", async () => {
    const s = client();
    const { data: u } = await s.from("users").insert({ name: "Ada" }).select().single();
    await s.from("posts").insert([{ title: "p1", author_id: u!.id }, { title: "p2", author_id: u!.id }]);
    const { data, error } = await s.from("users").select("name, posts(title)");
    expect(error).toBeNull();
    const titles = (data?.[0]?.posts as Array<{ title: string }>).map((p) => p.title).sort();
    expect(titles).toEqual(["p1", "p2"]);
  });
});
