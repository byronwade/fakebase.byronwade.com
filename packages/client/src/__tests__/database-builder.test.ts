/**
 * DatabaseBuilder unit tests.
 *
 * Tests query builder chaining, filter semantics, mutation return behaviour,
 * single/maybeSingle assertion, range 0-based indexing, and .or() parsing.
 */

import { describe, it, expect } from "vitest";
import { createMemoryKernel } from "@fakebase/adapter-memory";
import { DatabaseBuilder } from "../database-builder.js";
import type { ProjectSchemaIR } from "@fakebase/core";

// ---------------------------------------------------------------------------
// Test schema
// ---------------------------------------------------------------------------

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
        {
          name: "id",
          type: "uuid",
          nullable: false,
          primaryKey: true,
          defaultSql: "gen_random_uuid()",
        },
        { name: "name", type: "text", nullable: false },
        { name: "email", type: "text", nullable: true },
        { name: "age", type: "int4", nullable: true },
        { name: "role", type: "text", nullable: false, defaultSql: "'user'" },
        { name: "tags", type: "jsonb", nullable: true },
        { name: "active", type: "bool", nullable: false, defaultSql: "true" },
        { name: "score", type: "float4", nullable: true },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function builder() {
  const kernel = createMemoryKernel(schema);
  return {
    kernel,
    from: (table: string) => new DatabaseBuilder(kernel, table, "public"),
  };
}

// Seed helper — inserts rows directly and returns the kernel for reuse
async function seedKernel(
  rows: Record<string, unknown>[],
): Promise<ReturnType<typeof createMemoryKernel>> {
  const kernel = createMemoryKernel(schema);
  await kernel.query({
    schema: "public",
    table: "users",
    operation: "insert",
    filters: [],
    orderBy: [],
    returning: false,
    insertData: rows,
  });
  return kernel;
}

// ---------------------------------------------------------------------------
// SELECT
// ---------------------------------------------------------------------------

describe("SELECT", () => {
  it("returns all rows when no filters are applied", async () => {
    const kernel = await seedKernel([
      { name: "Alice", email: "alice@example.com", age: 30 },
      { name: "Bob", email: "bob@example.com", age: 25 },
    ]);
    const b = new DatabaseBuilder(kernel, "users");
    const { data, error } = await b.select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it("projects specific columns", async () => {
    const kernel = await seedKernel([{ name: "Alice", email: "a@b.com", age: 20 }]);
    const b = new DatabaseBuilder(kernel, "users");
    const { data, error } = await b.select("name, email");
    expect(error).toBeNull();
    expect(data?.[0]).toHaveProperty("name");
    expect(data?.[0]).toHaveProperty("email");
    expect(data?.[0]).not.toHaveProperty("age");
  });

  it("returns empty array when table is empty", async () => {
    const { from } = builder();
    const { data, error } = await from("users").select();
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// FILTERS
// ---------------------------------------------------------------------------

describe("filters", () => {
  it(".eq() matches exact values", async () => {
    const kernel = await seedKernel([
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ]);
    const { data } = await new DatabaseBuilder(kernel, "users")
      .select()
      .eq("name", "Alice");
    expect(data).toHaveLength(1);
    expect((data as Record<string, unknown>[])[0]?.["name"]).toBe("Alice");
  });

  it(".neq() excludes matching rows", async () => {
    const kernel = await seedKernel([
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ]);
    const { data } = await new DatabaseBuilder(kernel, "users")
      .select()
      .neq("name", "Alice");
    expect(data).toHaveLength(1);
    expect((data as Record<string, unknown>[])[0]?.["name"]).toBe("Bob");
  });

  it(".gt() / .gte() / .lt() / .lte() filter numeric ranges", async () => {
    const kernel = await seedKernel([
      { name: "A", age: 10 },
      { name: "B", age: 20 },
      { name: "C", age: 30 },
    ]);

    const gt = await new DatabaseBuilder(kernel, "users").select().gt("age", 15);
    expect(gt.data).toHaveLength(2);

    const gte = await new DatabaseBuilder(kernel, "users").select().gte("age", 20);
    expect(gte.data).toHaveLength(2);

    const lt = await new DatabaseBuilder(kernel, "users").select().lt("age", 20);
    expect(lt.data).toHaveLength(1);

    const lte = await new DatabaseBuilder(kernel, "users").select().lte("age", 20);
    expect(lte.data).toHaveLength(2);
  });

  it(".like() / .ilike() pattern matching", async () => {
    const kernel = await seedKernel([
      { name: "Alice" },
      { name: "ALICE" },
      { name: "Bob" },
    ]);

    const like = await new DatabaseBuilder(kernel, "users")
      .select()
      .like("name", "Ali%");
    expect(like.data).toHaveLength(1); // case-sensitive

    const ilike = await new DatabaseBuilder(kernel, "users")
      .select()
      .ilike("name", "ali%");
    expect(ilike.data).toHaveLength(2); // case-insensitive
  });

  it(".is() matches null and booleans", async () => {
    const kernel = await seedKernel([
      { name: "A", email: null },
      { name: "B", email: "b@b.com" },
    ]);
    const { data } = await new DatabaseBuilder(kernel, "users")
      .select()
      .is("email", null);
    expect(data).toHaveLength(1);
    expect((data as Record<string, unknown>[])[0]?.["name"]).toBe("A");
  });

  it(".in() matches rows whose column value is in the set", async () => {
    const kernel = await seedKernel([
      { name: "Alice" },
      { name: "Bob" },
      { name: "Charlie" },
    ]);
    const { data } = await new DatabaseBuilder(kernel, "users")
      .select()
      .in("name", ["Alice", "Charlie"]);
    expect(data).toHaveLength(2);
  });

  it(".match() ANDs multiple equality conditions", async () => {
    const kernel = await seedKernel([
      { name: "Alice", age: 30 },
      { name: "Alice", age: 25 },
      { name: "Bob", age: 30 },
    ]);
    const { data } = await new DatabaseBuilder(kernel, "users")
      .select()
      .match({ name: "Alice", age: 30 });
    expect(data).toHaveLength(1);
  });

  it(".not() negates a filter", async () => {
    const kernel = await seedKernel([
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ]);
    const { data } = await new DatabaseBuilder(kernel, "users")
      .select()
      .not("name", "eq", "Alice");
    expect(data).toHaveLength(1);
    expect((data as Record<string, unknown>[])[0]?.["name"]).toBe("Bob");
  });

  it(".or() with a simple PostgREST filter string", async () => {
    const kernel = await seedKernel([
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
      { name: "Charlie", age: 20 },
    ]);
    const { data } = await new DatabaseBuilder(kernel, "users")
      .select()
      .or("name.eq.Alice,age.lt.22");
    expect(data).toHaveLength(2);
    const names = (data as Record<string, unknown>[]).map((r) => r["name"]);
    expect(names).toContain("Alice");
    expect(names).toContain("Charlie");
  });

  it(".or() supports nested and(...) expressions", async () => {
    const kernel = await seedKernel([
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
      { name: "Charlie", age: 30 },
    ]);
    // Match: (name=Alice AND age=30) OR (name=Bob)
    const { data } = await new DatabaseBuilder(kernel, "users")
      .select()
      .or("and(name.eq.Alice,age.eq.30),name.eq.Bob");
    expect(data).toHaveLength(2);
    const names = (data as Record<string, unknown>[]).map((r) => r["name"]);
    expect(names).toContain("Alice");
    expect(names).toContain("Bob");
  });

  it(".filter() generic filter passes through", async () => {
    const kernel = await seedKernel([
      { name: "Alice", age: 30 },
      { name: "Bob", age: 20 },
    ]);
    const { data } = await new DatabaseBuilder(kernel, "users")
      .select()
      .filter("age", "gte", 30);
    expect(data).toHaveLength(1);
  });

  it("chaining multiple filters ANDs them", async () => {
    const kernel = await seedKernel([
      { name: "Alice", age: 30 },
      { name: "Alice", age: 25 },
      { name: "Bob", age: 30 },
    ]);
    const { data } = await new DatabaseBuilder(kernel, "users")
      .select()
      .eq("name", "Alice")
      .eq("age", 30);
    expect(data).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// MODIFIERS
// ---------------------------------------------------------------------------

describe("modifiers", () => {
  it(".order() sorts ascending by default", async () => {
    const kernel = await seedKernel([
      { name: "Charlie", age: 30 },
      { name: "Alice", age: 10 },
      { name: "Bob", age: 20 },
    ]);
    const { data } = await new DatabaseBuilder(kernel, "users").select().order("age");
    const ages = (data as Record<string, unknown>[]).map((r) => r["age"]);
    expect(ages).toEqual([10, 20, 30]);
  });

  it(".order() sorts descending when ascending: false", async () => {
    const kernel = await seedKernel([
      { name: "Charlie", age: 30 },
      { name: "Alice", age: 10 },
      { name: "Bob", age: 20 },
    ]);
    const { data } = await new DatabaseBuilder(kernel, "users")
      .select()
      .order("age", { ascending: false });
    const ages = (data as Record<string, unknown>[]).map((r) => r["age"]);
    expect(ages).toEqual([30, 20, 10]);
  });

  it(".limit() restricts result count", async () => {
    const kernel = await seedKernel([{ name: "A" }, { name: "B" }, { name: "C" }]);
    const { data } = await new DatabaseBuilder(kernel, "users").select().limit(2);
    expect(data).toHaveLength(2);
  });

  it(".range(from, to) is 0-based and inclusive", async () => {
    const kernel = await seedKernel([
      { name: "A", age: 1 },
      { name: "B", age: 2 },
      { name: "C", age: 3 },
      { name: "D", age: 4 },
      { name: "E", age: 5 },
    ]);
    // range(1, 3) should return rows at index 1, 2, 3 → B, C, D
    const { data } = await new DatabaseBuilder(kernel, "users")
      .select()
      .order("age")
      .range(1, 3);
    expect(data).toHaveLength(3);
    const names = (data as Record<string, unknown>[]).map((r) => r["name"]);
    expect(names).toEqual(["B", "C", "D"]);
  });

  it(".range(0, 0) returns exactly one row", async () => {
    const kernel = await seedKernel([
      { name: "A", age: 1 },
      { name: "B", age: 2 },
    ]);
    const { data } = await new DatabaseBuilder(kernel, "users")
      .select()
      .order("age")
      .range(0, 0);
    expect(data).toHaveLength(1);
    expect((data as Record<string, unknown>[])[0]?.["name"]).toBe("A");
  });

  it("count: exact returns total pre-pagination count", async () => {
    const kernel = await seedKernel([{ name: "A" }, { name: "B" }, { name: "C" }]);
    const { data, count } = await new DatabaseBuilder(kernel, "users").select("*", {
      count: "exact",
    });
    expect(count).toBe(3);
    expect(data).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// SINGLE / MAYBSINGLE
// ---------------------------------------------------------------------------

describe(".single()", () => {
  it("returns the row object when exactly 1 row matches", async () => {
    const kernel = await seedKernel([{ name: "Alice", age: 30 }]);
    const { data, error } = await new DatabaseBuilder(kernel, "users")
      .select()
      .single();
    expect(error).toBeNull();
    expect((data as Record<string, unknown>)?.["name"]).toBe("Alice");
  });

  it("errors with PGRST116 when 0 rows match", async () => {
    const { from } = builder();
    const { data, error } = await from("users").select().single();
    expect(data).toBeNull();
    expect(error?.code).toBe("PGRST116");
    expect(error?.status).toBe(406);
  });

  it("errors with PGRST116 when 2+ rows match", async () => {
    const kernel = await seedKernel([{ name: "A" }, { name: "B" }]);
    const { data, error } = await new DatabaseBuilder(kernel, "users")
      .select()
      .single();
    expect(data).toBeNull();
    expect(error?.code).toBe("PGRST116");
  });
});

describe(".maybeSingle()", () => {
  it("returns null when 0 rows match", async () => {
    const { from } = builder();
    const { data, error } = await from("users").select().maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("returns the row when exactly 1 row matches", async () => {
    const kernel = await seedKernel([{ name: "Alice" }]);
    const { data, error } = await new DatabaseBuilder(kernel, "users")
      .select()
      .maybeSingle();
    expect(error).toBeNull();
    expect((data as Record<string, unknown>)?.["name"]).toBe("Alice");
  });

  it("errors when 2+ rows match", async () => {
    const kernel = await seedKernel([{ name: "A" }, { name: "B" }]);
    const { data, error } = await new DatabaseBuilder(kernel, "users")
      .select()
      .maybeSingle();
    expect(data).toBeNull();
    expect(error?.code).toBe("PGRST116");
  });
});

// ---------------------------------------------------------------------------
// INSERT
// ---------------------------------------------------------------------------

describe("INSERT", () => {
  it("returns { data: null } without .select()", async () => {
    const { from } = builder();
    const { data, error } = await from("users").insert({ name: "Alice" });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("returns inserted rows when .select() is chained", async () => {
    const { from } = builder();
    const { data, error } = await from("users")
      .insert({ name: "Alice", age: 30 })
      .select("name, age");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect((data as Record<string, unknown>[])[0]?.["name"]).toBe("Alice");
  });

  it("inserts multiple rows at once", async () => {
    const { from } = builder();
    await from("users")
      .insert([{ name: "Alice" }, { name: "Bob" }])
      .select();
    const { data } = await from("users").select();
    expect(data).toHaveLength(2);
  });

  it("auto-generates uuid primary key", async () => {
    const { from } = builder();
    const { data } = await from("users").insert({ name: "Alice" }).select("id");
    const id = (data as Record<string, unknown>[])[0]?.["id"];
    expect(typeof id).toBe("string");
    expect((id as string).length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

describe("UPDATE", () => {
  it("returns { data: null } without .select()", async () => {
    const kernel = await seedKernel([{ name: "Alice", age: 30 }]);
    const { data, error } = await new DatabaseBuilder(kernel, "users")
      .update({ age: 31 })
      .eq("name", "Alice");
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("updates matching rows and returns them when .select() is chained", async () => {
    const kernel = await seedKernel([{ name: "Alice", age: 30 }]);
    const { data, error } = await new DatabaseBuilder(kernel, "users")
      .update({ age: 31 })
      .eq("name", "Alice")
      .select("age");
    expect(error).toBeNull();
    expect((data as Record<string, unknown>[])[0]?.["age"]).toBe(31);
  });

  it("only updates rows matching filters", async () => {
    const kernel = await seedKernel([
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ]);
    await new DatabaseBuilder(kernel, "users").update({ age: 99 }).eq("name", "Alice");
    const { data } = await new DatabaseBuilder(kernel, "users")
      .select()
      .eq("name", "Bob");
    expect((data as Record<string, unknown>[])[0]?.["age"]).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// UPSERT
// ---------------------------------------------------------------------------

describe("UPSERT", () => {
  it("inserts when no conflict exists", async () => {
    const { from } = builder();
    await from("users").upsert({ id: "fixed-id-1", name: "Alice" });
    const { data } = await from("users").select();
    expect(data).toHaveLength(1);
  });

  it("updates on conflict (matched by onConflict column)", async () => {
    const { from } = builder();
    await from("users").upsert({ id: "fixed-id-1", name: "Alice", age: 30 });
    await from("users").upsert(
      { id: "fixed-id-1", name: "Alice Updated", age: 31 },
      { onConflict: "id" },
    );
    const { data } = await from("users").select();
    expect(data).toHaveLength(1);
    expect((data as Record<string, unknown>[])[0]?.["name"]).toBe("Alice Updated");
  });

  it("returns { data: null } without .select()", async () => {
    const { from } = builder();
    const { data } = await from("users").upsert({ name: "Alice" });
    expect(data).toBeNull();
  });

  it("returns upserted rows when .select() is chained", async () => {
    const { from } = builder();
    const { data } = await from("users").upsert({ name: "Alice" }).select("name");
    expect((data as Record<string, unknown>[])[0]?.["name"]).toBe("Alice");
  });
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

describe("DELETE", () => {
  it("returns { data: null } without .select()", async () => {
    const kernel = await seedKernel([{ name: "Alice" }]);
    const { data, error } = await new DatabaseBuilder(kernel, "users")
      .delete()
      .eq("name", "Alice");
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("deletes matching rows", async () => {
    const kernel = await seedKernel([{ name: "Alice" }, { name: "Bob" }]);
    await new DatabaseBuilder(kernel, "users").delete().eq("name", "Alice");
    const { data } = await new DatabaseBuilder(kernel, "users").select();
    expect(data).toHaveLength(1);
    expect((data as Record<string, unknown>[])[0]?.["name"]).toBe("Bob");
  });

  it("returns deleted rows when .select() is chained", async () => {
    const kernel = await seedKernel([{ name: "Alice" }, { name: "Bob" }]);
    const { data } = await new DatabaseBuilder(kernel, "users")
      .delete()
      .eq("name", "Alice")
      .select("name");
    expect(data).toHaveLength(1);
    expect((data as Record<string, unknown>[])[0]?.["name"]).toBe("Alice");
  });
});

// ---------------------------------------------------------------------------
// CSV output
// ---------------------------------------------------------------------------

describe(".csv()", () => {
  it("returns CSV string with headers and rows", async () => {
    const kernel = await seedKernel([
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ]);
    const { data, error } = await new DatabaseBuilder(kernel, "users")
      .select("name, age")
      .order("age")
      .csv();
    expect(error).toBeNull();
    expect(typeof data).toBe("string");
    expect(data).toContain("name");
    expect(data).toContain("Alice");
    expect(data).toContain("Bob");
  });

  it("returns empty string for empty result", async () => {
    const { from } = builder();
    const { data } = await from("users").select().csv();
    expect(data).toBe("");
  });
});

// ---------------------------------------------------------------------------
// AbortSignal
// ---------------------------------------------------------------------------

describe("abortSignal", () => {
  it("returns an error immediately when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const { from } = builder();
    const { data, error } = await from("users").select().abortSignal(controller.signal);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});
