import { describe, it, expect } from "vitest";
import type { ProjectSchemaIR } from "@fakebase/core";
import { exportSupabaseSql, exportSeedSql } from "../export-sql.js";

const SCHEMA: ProjectSchemaIR = {
  version: 1,
  tables: [
    {
      schema: "public",
      name: "users",
      primaryKey: "id",
      rlsEnabled: false,
      columns: [
        {
          name: "id",
          type: "uuid",
          nullable: false,
          primaryKey: true,
          defaultSql: "gen_random_uuid()",
        },
        { name: "email", type: "text", nullable: false, unique: true },
        { name: "name", type: "text", nullable: true },
        { name: "age", type: "int4", nullable: true },
        {
          name: "created_at",
          type: "timestamptz",
          nullable: false,
          defaultSql: "now()",
        },
      ],
      indexes: [{ name: "users_email_idx", columns: ["email"], unique: true }],
      policies: [],
    },
    {
      schema: "public",
      name: "posts",
      primaryKey: "id",
      rlsEnabled: true,
      columns: [
        {
          name: "id",
          type: "uuid",
          nullable: false,
          primaryKey: true,
          defaultSql: "gen_random_uuid()",
        },
        {
          name: "user_id",
          type: "uuid",
          nullable: false,
          references: { table: "users", column: "id" },
        },
        { name: "title", type: "text", nullable: false },
        { name: "published", type: "bool", nullable: false, defaultSql: "false" },
      ],
      indexes: [],
      policies: [
        {
          name: "posts_owner_only",
          table: "posts",
          schema: "public",
          command: "ALL",
          roles: ["authenticated"],
          using: "auth.uid() = user_id",
          permissive: true,
        },
      ],
    },
  ],
  enums: [
    { schema: "public", name: "user_role", values: ["admin", "user", "moderator"] },
  ],
  functions: [],
};

describe("exportSupabaseSql", () => {
  it("starts with the header comment", () => {
    const sql = exportSupabaseSql(SCHEMA);
    expect(sql).toMatch(/^-- Fakebase generated migration\n-- Generated: /);
  });

  it("contains CREATE TABLE for each table", () => {
    const sql = exportSupabaseSql(SCHEMA);
    expect(sql).toContain('create table if not exists "public"."users"');
    expect(sql).toContain('create table if not exists "public"."posts"');
  });

  it("maps IR types to Postgres types correctly", () => {
    const sql = exportSupabaseSql(SCHEMA);
    expect(sql).toContain('"id" uuid');
    expect(sql).toContain('"email" text');
    expect(sql).toContain('"age" integer');
    expect(sql).toContain('"published" boolean');
    expect(sql).toContain('"created_at" timestamptz');
  });

  it("outputs users before posts (topological order respects FK)", () => {
    const sql = exportSupabaseSql(SCHEMA);
    const usersPos = sql.indexOf('"public"."users"');
    const postsPos = sql.indexOf('"public"."posts"');
    expect(usersPos).toBeLessThan(postsPos);
  });

  it("includes NOT NULL constraint for non-nullable columns", () => {
    const sql = exportSupabaseSql(SCHEMA);
    expect(sql).toContain('"email" text not null');
  });

  it("includes UNIQUE constraint on unique columns", () => {
    const sql = exportSupabaseSql(SCHEMA);
    expect(sql).toContain('"email" text not null unique');
  });

  it("includes DEFAULT clause", () => {
    const sql = exportSupabaseSql(SCHEMA);
    expect(sql).toContain("default gen_random_uuid()");
    expect(sql).toContain("default now()");
  });

  it("includes PRIMARY KEY constraint", () => {
    const sql = exportSupabaseSql(SCHEMA);
    expect(sql).toContain('primary key ("id")');
  });

  it("includes FOREIGN KEY inline reference", () => {
    const sql = exportSupabaseSql(SCHEMA);
    expect(sql).toContain('references "users"("id")');
  });

  it("includes CREATE INDEX statements", () => {
    const sql = exportSupabaseSql(SCHEMA);
    expect(sql).toContain('create unique index if not exists "users_email_idx"');
  });

  it("includes RLS enablement for rlsEnabled tables (includeRls default true)", () => {
    const sql = exportSupabaseSql(SCHEMA);
    expect(sql).toContain('alter table "public"."posts" enable row level security;');
  });

  it("does NOT enable RLS for tables with rlsEnabled=false", () => {
    const sql = exportSupabaseSql(SCHEMA);
    expect(sql).not.toContain(
      'alter table "public"."users" enable row level security;',
    );
  });

  it("includes RLS policy CREATE POLICY statement", () => {
    const sql = exportSupabaseSql(SCHEMA);
    expect(sql).toContain('create policy "posts_owner_only"');
    expect(sql).toContain("for all");
    expect(sql).toContain("to authenticated");
    expect(sql).toContain("using ( auth.uid() = user_id )");
  });

  it("skips RLS when includeRls=false", () => {
    const sql = exportSupabaseSql(SCHEMA, { includeRls: false });
    expect(sql).not.toContain("enable row level security");
    expect(sql).not.toContain("create policy");
  });

  it("includes GRANT statements by default", () => {
    const sql = exportSupabaseSql(SCHEMA);
    expect(sql).toContain('grant usage on schema "public" to anon, authenticated;');
    expect(sql).toContain('grant select, insert, update, delete on "public"."users"');
  });

  it("skips grants when includeGrants=false", () => {
    const sql = exportSupabaseSql(SCHEMA, { includeGrants: false });
    expect(sql).not.toContain("grant usage");
  });

  it("ends with the footer verification comment", () => {
    const sql = exportSupabaseSql(SCHEMA);
    expect(sql).toContain(
      "Migration complete. Verify the above SQL before applying to production.",
    );
  });

  it("snapshot — output is stable across calls (same schema, no timestamp difference matters for structure)", () => {
    const sql = exportSupabaseSql(SCHEMA);
    const lines = sql.split("\n").filter((l) => !l.startsWith("-- Generated:"));
    expect(lines.join("\n")).toMatchSnapshot();
  });
});

describe("exportSeedSql", () => {
  const rows = {
    users: [
      {
        id: "u1",
        email: "alice@example.com",
        name: "Alice",
        age: 30,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "u2",
        email: "bob@example.com",
        name: "Bob",
        age: null,
        created_at: "2026-01-02T00:00:00Z",
      },
    ],
    posts: [{ id: "p1", user_id: "u1", title: "Hello", published: true }],
  };

  it("generates INSERT statements", () => {
    const sql = exportSeedSql(SCHEMA, rows);
    expect(sql).toContain('insert into "public"."users"');
    expect(sql).toContain('insert into "public"."posts"');
  });

  it("omits the timestamp header when { timestamp: false }, for byte-stable output", () => {
    const a = exportSeedSql(SCHEMA, rows, { timestamp: false });
    const b = exportSeedSql(SCHEMA, rows, { timestamp: false });
    expect(a).not.toContain("-- Generated:");
    expect(a).toBe(b); // identical across calls — clean git diffs
  });

  it("renders null values correctly", () => {
    const sql = exportSeedSql(SCHEMA, rows);
    expect(sql).toContain("null");
  });

  it("renders boolean values correctly", () => {
    const sql = exportSeedSql(SCHEMA, rows);
    expect(sql).toContain("true");
  });

  it("quotes string values with single quotes", () => {
    const sql = exportSeedSql(SCHEMA, rows);
    expect(sql).toContain("'alice@example.com'");
  });
});
