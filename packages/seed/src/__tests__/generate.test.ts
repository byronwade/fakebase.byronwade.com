import { describe, expect, it } from "vitest";
import type {
  ColumnIR,
  EnumIR,
  ProjectSchemaIR,
  TableIR,
} from "@byronwade/core";
import { generateRows } from "../generate.js";

function table(
  name: string,
  columns: ColumnIR[],
  primaryKey = "id",
): TableIR {
  return {
    schema: "public",
    name,
    primaryKey,
    rlsEnabled: false,
    indexes: [],
    policies: [],
    columns,
  };
}

function schema(tables: TableIR[], enums: EnumIR[] = []): ProjectSchemaIR {
  return { tables, enums, functions: [], version: 1 };
}

const ID: ColumnIR = { name: "id", type: "uuid", nullable: false, primaryKey: true };

describe("generateRows — counts", () => {
  it("generates the requested number of rows per table by default", () => {
    const s = schema([table("users", [ID])]);
    const rows = generateRows(s, { rowsPerTable: 7 });
    expect(rows["public.users"]).toHaveLength(7);
  });

  it("honors per-table count overrides", () => {
    const s = schema([table("users", [ID]), table("posts", [ID])]);
    const rows = generateRows(s, { rowsPerTable: 3, tables: { posts: 10 } });
    expect(rows["public.users"]).toHaveLength(3);
    expect(rows["public.posts"]).toHaveLength(10);
  });
});

describe("generateRows — determinism", () => {
  it("produces identical output for the same seed", () => {
    const s = schema([
      table("users", [ID, { name: "email", type: "text", nullable: false }]),
    ]);
    const a = generateRows(s, { rowsPerTable: 5, seed: 123 });
    const b = generateRows(s, { rowsPerTable: 5, seed: 123 });
    expect(b).toEqual(a);
  });

  it("produces different output for a different seed", () => {
    const s = schema([
      table("users", [ID, { name: "email", type: "text", nullable: false }]),
    ]);
    const a = generateRows(s, { rowsPerTable: 5, seed: 1 });
    const b = generateRows(s, { rowsPerTable: 5, seed: 2 });
    expect(b).not.toEqual(a);
  });
});

describe("generateRows — primary keys", () => {
  it("generates a unique value for every primary key", () => {
    const s = schema([table("users", [ID])]);
    const rows = generateRows(s, { rowsPerTable: 50 });
    const ids = rows["public.users"].map((r) => r.id);
    expect(new Set(ids).size).toBe(50);
  });
});

describe("generateRows — foreign keys", () => {
  it("only assigns FK values that exist in the parent table", () => {
    const s = schema([
      table("users", [ID]),
      table("posts", [
        ID,
        {
          name: "author_id",
          type: "uuid",
          nullable: false,
          references: { table: "users", column: "id" },
        },
      ]),
    ]);
    const rows = generateRows(s, { rowsPerTable: 20, seed: 5 });
    const userIds = new Set(rows["public.users"].map((r) => r.id));
    for (const post of rows["public.posts"]) {
      expect(userIds.has(post.author_id)).toBe(true);
    }
  });
});

describe("generateRows — enums", () => {
  it("only assigns declared enum values", () => {
    const s = schema(
      [
        table("posts", [
          ID,
          { name: "status", type: "post_status", nullable: false },
        ]),
      ],
      [{ schema: "public", name: "post_status", values: ["draft", "published"] }],
    );
    const rows = generateRows(s, { rowsPerTable: 30, seed: 9 });
    for (const post of rows["public.posts"]) {
      expect(["draft", "published"]).toContain(post.status);
    }
  });
});

describe("generateRows — constraints", () => {
  it("keeps unique columns distinct", () => {
    const s = schema([
      table("users", [
        ID,
        { name: "email", type: "text", nullable: false, unique: true },
      ]),
    ]);
    const rows = generateRows(s, { rowsPerTable: 40, seed: 3 });
    const emails = rows["public.users"].map((r) => r.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it("emits null for nullable columns when nullRate is 1", () => {
    const s = schema([
      table("users", [ID, { name: "bio", type: "text", nullable: true }]),
    ]);
    const rows = generateRows(s, { rowsPerTable: 10, nullRate: 1 });
    for (const r of rows["public.users"]) expect(r.bio).toBeNull();
  });

  it("skips database-generated and defaulted non-PK columns", () => {
    const s = schema([
      table("users", [
        ID,
        { name: "created_at", type: "timestamptz", nullable: false, defaultSql: "now()" },
        { name: "seq", type: "int8", nullable: false, generated: true },
      ]),
    ]);
    const rows = generateRows(s, { rowsPerTable: 3 });
    for (const r of rows["public.users"]) {
      expect("created_at" in r).toBe(false);
      expect("seq" in r).toBe(false);
    }
  });
});

describe("generateRows — overrides", () => {
  it("applies a per-column override (table.col and schema.table.col forms)", () => {
    const s = schema([
      table("posts", [ID, { name: "title", type: "text", nullable: false }]),
    ]);
    const rows = generateRows(s, {
      rowsPerTable: 4,
      overrides: { "posts.title": () => "FIXED" },
    });
    for (const r of rows["public.posts"]) expect(r.title).toBe("FIXED");

    const rows2 = generateRows(s, {
      rowsPerTable: 4,
      overrides: { "public.posts.title": () => "QUALIFIED" },
    });
    for (const r of rows2["public.posts"]) expect(r.title).toBe("QUALIFIED");
  });
});

describe("generateRows — semantic inference", () => {
  it("uses the column name to produce realistic values", () => {
    const s = schema([
      table("users", [ID, { name: "email", type: "text", nullable: false }]),
    ]);
    const rows = generateRows(s, { rowsPerTable: 5 });
    for (const r of rows["public.users"]) {
      expect(String(r.email)).toContain("@");
    }
  });
});
