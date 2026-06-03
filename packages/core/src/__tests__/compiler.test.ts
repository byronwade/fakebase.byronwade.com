import { describe, expect, it } from "vitest";
import { compileQuery } from "../query/compiler.js";
import type { QueryOptions } from "../query/compiler.js";

const rows = [
  { id: 1, name: "Alice", age: 30, active: true },
  { id: 2, name: "Bob", age: 25, active: false },
  { id: 3, name: "Charlie", age: 35, active: true },
  { id: 4, name: "Diana", age: 28, active: true },
  { id: 5, name: "Eve", age: 22, active: false },
];

function baseOpts(overrides: Partial<QueryOptions> = {}): QueryOptions {
  return {
    table: "users",
    schema: "public",
    filters: [],
    ...overrides,
  };
}

describe("compileQuery – basic", () => {
  it("returns all rows when no options", () => {
    const result = compileQuery(baseOpts(), rows);
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(5);
    expect(result.status).toBe(200);
  });

  it("returns null count when count option absent", () => {
    const result = compileQuery(baseOpts(), rows);
    expect(result.count).toBeNull();
  });

  it("returns exact count when count: exact", () => {
    const result = compileQuery(baseOpts({ count: "exact" }), rows);
    expect(result.count).toBe(5);
  });
});

describe("compileQuery – select projection", () => {
  it("projects selected columns only", () => {
    const result = compileQuery(baseOpts({ select: ["id", "name"] }), rows);
    expect(result.data?.[0]).toEqual({ id: 1, name: "Alice" });
    expect(result.data?.[0]).not.toHaveProperty("age");
  });
});

describe("compileQuery – filtering", () => {
  it("filters by eq", () => {
    const result = compileQuery(
      baseOpts({ filters: [{ column: "active", operator: "eq", value: true }] }),
      rows,
    );
    expect(result.data).toHaveLength(3);
    expect(result.data?.every((r) => r["active"] === true)).toBe(true);
  });

  it("filters by gt", () => {
    const result = compileQuery(
      baseOpts({ filters: [{ column: "age", operator: "gt", value: 28 }] }),
      rows,
    );
    expect(result.data?.map((r) => r["name"])).toEqual(["Alice", "Charlie"]);
  });

  it("multiple filters are ANDed", () => {
    const result = compileQuery(
      baseOpts({
        filters: [
          { column: "active", operator: "eq", value: true },
          { column: "age", operator: "lt", value: 32 },
        ],
      }),
      rows,
    );
    expect(result.data?.map((r) => r["name"])).toEqual(["Alice", "Diana"]);
  });

  it("returns empty when no rows match", () => {
    const result = compileQuery(
      baseOpts({ filters: [{ column: "age", operator: "gt", value: 100 }] }),
      rows,
    );
    expect(result.data).toHaveLength(0);
  });
});

describe("compileQuery – ordering", () => {
  it("sorts ascending", () => {
    const result = compileQuery(
      baseOpts({ orderBy: [{ column: "age", ascending: true }] }),
      rows,
    );
    const ages = result.data?.map((r) => r["age"]);
    expect(ages).toEqual([22, 25, 28, 30, 35]);
  });

  it("sorts descending", () => {
    const result = compileQuery(
      baseOpts({ orderBy: [{ column: "age", ascending: false }] }),
      rows,
    );
    const ages = result.data?.map((r) => r["age"]);
    expect(ages).toEqual([35, 30, 28, 25, 22]);
  });

  it("multi-column sort", () => {
    const data = [
      { id: 1, group: "a", rank: 2 },
      { id: 2, group: "b", rank: 1 },
      { id: 3, group: "a", rank: 1 },
    ];
    const result = compileQuery(
      baseOpts({
        orderBy: [
          { column: "group", ascending: true },
          { column: "rank", ascending: true },
        ],
      }),
      data,
    );
    expect(result.data?.map((r) => r["id"])).toEqual([3, 1, 2]);
  });
});

describe("compileQuery – pagination", () => {
  it("applies limit", () => {
    const result = compileQuery(baseOpts({ limit: 2 }), rows);
    expect(result.data).toHaveLength(2);
  });

  it("applies offset", () => {
    const result = compileQuery(baseOpts({ offset: 3 }), rows);
    expect(result.data?.map((r) => r["id"])).toEqual([4, 5]);
  });

  it("applies limit + offset together", () => {
    const result = compileQuery(baseOpts({ limit: 2, offset: 1 }), rows);
    expect(result.data?.map((r) => r["id"])).toEqual([2, 3]);
  });

  it("count reflects pre-pagination total", () => {
    const result = compileQuery(baseOpts({ limit: 2, count: "exact" }), rows);
    expect(result.count).toBe(5);
    expect(result.data).toHaveLength(2);
  });
});
