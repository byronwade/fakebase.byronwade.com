import { describe, it, expect, afterEach } from "vitest";

import type { ProjectSchemaIR } from "@byronwade/core";
import { PGliteAdapter } from "../pglite-adapter.js";

function makeSchema(): ProjectSchemaIR {
  return {
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
        indexes: [{ name: "idx_users_email", columns: ["email"], unique: true }],
        columns: [
          { name: "id", type: "uuid", nullable: false, primaryKey: true },
          { name: "email", type: "text", nullable: false, unique: true },
          { name: "age", type: "int4", nullable: true },
          { name: "active", type: "bool", nullable: true },
          { name: "metadata", type: "jsonb", nullable: true },
          { name: "score", type: "float8", nullable: true },
          {
            name: "created_at",
            type: "timestamptz",
            nullable: false,
            defaultSql: "now()",
          },
        ],
      },
    ],
  };
}

describe("PGliteAdapter — Postgres-in-WASM", () => {
  let adapter: PGliteAdapter;

  afterEach(async () => {
    await adapter.close();
  });

  function init(): PGliteAdapter {
    adapter = new PGliteAdapter({ dataDir: "memory://" });
    adapter.initialize(makeSchema());
    return adapter;
  }

  it("insert and select round-trip", async () => {
    init();
    await adapter.insert("users", "public", [
      { id: "user-1", email: "alice@example.com", age: 30 },
    ]);

    const result = await adapter.select("users", "public", {
      table: "users",
      schema: "public",
      filters: [{ column: "id", operator: "eq", value: "user-1" }],
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data![0]!["email"]).toBe("alice@example.com");
    expect(result.data![0]!["age"]).toBe(30);
  });

  it("applies column defaults for omitted NOT NULL columns", async () => {
    init();
    const [row] = await adapter.insert("users", "public", [
      { id: "user-2", email: "bob@example.com" },
    ]);
    expect(typeof row!["created_at"]).toBe("string");
  });

  it("round-trips jsonb and boolean values natively", async () => {
    init();
    const metadata = { role: "admin", perms: ["read", "write"] };
    await adapter.insert("users", "public", [
      { id: "user-3", email: "carol@example.com", active: true, metadata },
    ]);

    const result = await adapter.select("users", "public", {
      table: "users",
      schema: "public",
      filters: [{ column: "id", operator: "eq", value: "user-3" }],
    });
    const row = result.data![0]!;
    expect(row["active"]).toBe(true);
    expect(row["metadata"]).toEqual(metadata);
  });

  it("updates and deletes matching rows", async () => {
    init();
    await adapter.insert("users", "public", [
      { id: "user-4", email: "dan@example.com", age: 40 },
    ]);

    await adapter.update("users", "public", { age: 41 }, [
      { column: "id", operator: "eq", value: "user-4" },
    ]);
    let result = await adapter.select("users", "public", {
      table: "users",
      schema: "public",
      filters: [],
    });
    expect(result.data![0]!["age"]).toBe(41);

    await adapter.delete("users", "public", [
      { column: "id", operator: "eq", value: "user-4" },
    ]);
    result = await adapter.select("users", "public", {
      table: "users",
      schema: "public",
      filters: [],
    });
    expect(result.data).toHaveLength(0);
  });

  it("upsert inserts then updates on conflict", async () => {
    init();
    await adapter.upsert("users", "public", [
      { id: "user-5", email: "erin@example.com", age: 20 },
    ]);
    await adapter.upsert("users", "public", [
      { id: "user-5", email: "erin@example.com", age: 21 },
    ]);

    const result = await adapter.select("users", "public", {
      table: "users",
      schema: "public",
      filters: [{ column: "id", operator: "eq", value: "user-5" }],
    });
    expect(result.data).toHaveLength(1);
    expect(result.data![0]!["age"]).toBe(21);
  });
});
