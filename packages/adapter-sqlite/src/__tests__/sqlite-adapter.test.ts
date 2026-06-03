import { describe, it, expect, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import Database from "better-sqlite3";

import { SqliteAdapter } from "../sqlite-adapter.js";
import type { ProjectSchemaIR } from "@fakebase/core";

function tempDb(): string {
  return join(
    tmpdir(),
    `fakebase-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
  );
}

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
          { name: "created_at", type: "timestamptz", nullable: true },
        ],
      },
    ],
  };
}

describe("SqliteAdapter — basic CRUD", () => {
  let adapter: SqliteAdapter;
  let dbPath: string;

  afterEach(async () => {
    await adapter.close();
    try {
      rmSync(dbPath);
      rmSync(`${dbPath}-wal`, { force: true });
      rmSync(`${dbPath}-shm`, { force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("initialize creates the table and sets WAL mode", async () => {
    dbPath = tempDb();
    adapter = new SqliteAdapter({ dbPath });
    await adapter.initialize(makeSchema());

    const db = new Database(dbPath, { readonly: true });
    const result = db.pragma("journal_mode") as { journal_mode: string }[];
    db.close();

    expect(result[0]?.journal_mode).toBe("wal");
  });

  it("insert and select round-trip", async () => {
    dbPath = tempDb();
    adapter = new SqliteAdapter({ dbPath });
    await adapter.initialize(makeSchema());

    await adapter.insert("users", "public", [
      {
        id: "user-1",
        email: "alice@example.com",
        age: 30,
        active: true,
        metadata: { role: "admin" },
        score: 9.5,
        created_at: "2024-01-01T00:00:00Z",
      },
    ]);

    const result = await adapter.select("users", "public", {
      table: "users",
      schema: "public",
      filters: [{ column: "id", operator: "eq", value: "user-1" }],
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    const row = result.data![0]!;
    expect(row["id"]).toBe("user-1");
    expect(row["email"]).toBe("alice@example.com");
    expect(row["age"]).toBe(30);
  });

  it("JSONB fields serialize and deserialize correctly", async () => {
    dbPath = tempDb();
    adapter = new SqliteAdapter({ dbPath });
    await adapter.initialize(makeSchema());

    const metadata = { role: "admin", permissions: ["read", "write"] };
    await adapter.insert("users", "public", [
      { id: "user-2", email: "bob@example.com", metadata },
    ]);

    const result = await adapter.select("users", "public", {
      table: "users",
      schema: "public",
      filters: [{ column: "id", operator: "eq", value: "user-2" }],
    });

    expect(result.data![0]?.["metadata"]).toEqual(metadata);
  });

  it("boolean fields serialize and deserialize correctly", async () => {
    dbPath = tempDb();
    adapter = new SqliteAdapter({ dbPath });
    await adapter.initialize(makeSchema());

    await adapter.insert("users", "public", [
      { id: "user-3", email: "carol@example.com", active: false },
    ]);

    const result = await adapter.select("users", "public", {
      table: "users",
      schema: "public",
      filters: [{ column: "id", operator: "eq", value: "user-3" }],
    });

    expect(result.data![0]?.["active"]).toBe(false);
  });

  it("select with eq filter", async () => {
    dbPath = tempDb();
    adapter = new SqliteAdapter({ dbPath });
    await adapter.initialize(makeSchema());

    await adapter.insert("users", "public", [
      { id: "u-a", email: "a@test.com", age: 20 },
      { id: "u-b", email: "b@test.com", age: 30 },
    ]);

    const result = await adapter.select("users", "public", {
      table: "users",
      schema: "public",
      filters: [{ column: "age", operator: "gte", value: 25 }],
    });

    expect(result.data).toHaveLength(1);
    expect(result.data![0]?.["id"]).toBe("u-b");
  });

  it("select with 'in' filter", async () => {
    dbPath = tempDb();
    adapter = new SqliteAdapter({ dbPath });
    await adapter.initialize(makeSchema());

    await adapter.insert("users", "public", [
      { id: "u-1", email: "one@test.com" },
      { id: "u-2", email: "two@test.com" },
      { id: "u-3", email: "three@test.com" },
    ]);

    const result = await adapter.select("users", "public", {
      table: "users",
      schema: "public",
      filters: [{ column: "id", operator: "in", value: ["u-1", "u-3"] }],
    });

    expect(result.data).toHaveLength(2);
    const ids = result.data!.map((r) => r["id"]).sort();
    expect(ids).toEqual(["u-1", "u-3"]);
  });

  it("update modifies matching rows", async () => {
    dbPath = tempDb();
    adapter = new SqliteAdapter({ dbPath });
    await adapter.initialize(makeSchema());

    await adapter.insert("users", "public", [
      { id: "u-x", email: "x@test.com", age: 10 },
    ]);

    const updated = await adapter.update("users", "public", { age: 99 }, [
      { column: "id", operator: "eq", value: "u-x" },
    ]);

    expect(updated).toHaveLength(1);
    expect(updated[0]?.["age"]).toBe(99);
  });

  it("delete removes matching rows and returns them", async () => {
    dbPath = tempDb();
    adapter = new SqliteAdapter({ dbPath });
    await adapter.initialize(makeSchema());

    await adapter.insert("users", "public", [
      { id: "del-1", email: "del@test.com" },
      { id: "del-2", email: "keep@test.com" },
    ]);

    const deleted = await adapter.delete("users", "public", [
      { column: "id", operator: "eq", value: "del-1" },
    ]);

    expect(deleted).toHaveLength(1);
    expect(deleted[0]?.["id"]).toBe("del-1");

    const remaining = await adapter.select("users", "public", {
      table: "users",
      schema: "public",
      filters: [],
    });
    expect(remaining.data).toHaveLength(1);
  });

  it("upsert inserts new row and updates existing one", async () => {
    dbPath = tempDb();
    adapter = new SqliteAdapter({ dbPath });
    await adapter.initialize(makeSchema());

    await adapter.upsert("users", "public", [
      { id: "upsert-1", email: "upsert@test.com", age: 1 },
    ]);

    // Update existing
    const result = await adapter.upsert("users", "public", [
      { id: "upsert-1", email: "upsert@test.com", age: 42 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.["age"]).toBe(42);
  });

  it("rpc throws CapabilityError", async () => {
    dbPath = tempDb();
    adapter = new SqliteAdapter({ dbPath });
    await adapter.initialize(makeSchema());

    await expect(adapter.rpc("my_func", {})).rejects.toThrow("rpc");
  });

  it("select with orderBy and limit", async () => {
    dbPath = tempDb();
    adapter = new SqliteAdapter({ dbPath });
    await adapter.initialize(makeSchema());

    await adapter.insert("users", "public", [
      { id: "o-1", email: "o1@test.com", age: 30 },
      { id: "o-2", email: "o2@test.com", age: 10 },
      { id: "o-3", email: "o3@test.com", age: 20 },
    ]);

    const result = await adapter.select("users", "public", {
      table: "users",
      schema: "public",
      filters: [],
      orderBy: [{ column: "age", ascending: true }],
      limit: 2,
    });

    expect(result.data).toHaveLength(2);
    expect(result.data![0]?.["age"]).toBe(10);
    expect(result.data![1]?.["age"]).toBe(20);
  });
});
