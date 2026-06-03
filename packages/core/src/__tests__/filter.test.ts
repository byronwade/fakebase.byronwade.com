import { describe, expect, it } from "vitest";
import { applyFilter, parseOrString } from "../query/filter.js";
import type { FilterNode, OrNode, AndNode } from "../query/filter.js";

const row = {
  id: 1,
  name: "Alice",
  age: 30,
  active: true,
  score: 9.5,
  tags: ["admin", "user"],
  meta: { role: "admin" },
  parent_id: null,
};

describe("applyFilter – leaf operators", () => {
  it("eq", () => {
    expect(applyFilter(row, { column: "name", operator: "eq", value: "Alice" })).toBe(
      true,
    );
    expect(applyFilter(row, { column: "name", operator: "eq", value: "Bob" })).toBe(
      false,
    );
  });

  it("neq", () => {
    expect(applyFilter(row, { column: "name", operator: "neq", value: "Bob" })).toBe(
      true,
    );
    expect(applyFilter(row, { column: "name", operator: "neq", value: "Alice" })).toBe(
      false,
    );
  });

  it("gt / gte", () => {
    expect(applyFilter(row, { column: "age", operator: "gt", value: 25 })).toBe(true);
    expect(applyFilter(row, { column: "age", operator: "gt", value: 30 })).toBe(false);
    expect(applyFilter(row, { column: "age", operator: "gte", value: 30 })).toBe(true);
  });

  it("lt / lte", () => {
    expect(applyFilter(row, { column: "age", operator: "lt", value: 35 })).toBe(true);
    expect(applyFilter(row, { column: "age", operator: "lt", value: 30 })).toBe(false);
    expect(applyFilter(row, { column: "age", operator: "lte", value: 30 })).toBe(true);
  });

  it("like", () => {
    expect(applyFilter(row, { column: "name", operator: "like", value: "Al%" })).toBe(
      true,
    );
    expect(applyFilter(row, { column: "name", operator: "like", value: "Bob%" })).toBe(
      false,
    );
    expect(applyFilter(row, { column: "name", operator: "like", value: "%ice" })).toBe(
      true,
    );
  });

  it("ilike – case-insensitive", () => {
    expect(
      applyFilter(row, { column: "name", operator: "ilike", value: "ALICE" }),
    ).toBe(true);
    expect(applyFilter(row, { column: "name", operator: "ilike", value: "al%" })).toBe(
      true,
    );
  });

  it("is null / not null", () => {
    expect(applyFilter(row, { column: "parent_id", operator: "is", value: null })).toBe(
      true,
    );
    expect(applyFilter(row, { column: "name", operator: "is", value: null })).toBe(
      false,
    );
  });

  it("is true / false", () => {
    expect(applyFilter(row, { column: "active", operator: "is", value: true })).toBe(
      true,
    );
    expect(applyFilter(row, { column: "active", operator: "is", value: false })).toBe(
      false,
    );
  });

  it("in", () => {
    expect(
      applyFilter(row, { column: "age", operator: "in", value: [20, 30, 40] }),
    ).toBe(true);
    expect(applyFilter(row, { column: "age", operator: "in", value: [20, 25] })).toBe(
      false,
    );
  });

  it("contains – array", () => {
    expect(
      applyFilter(row, { column: "tags", operator: "contains", value: ["admin"] }),
    ).toBe(true);
    expect(
      applyFilter(row, {
        column: "tags",
        operator: "contains",
        value: ["admin", "user"],
      }),
    ).toBe(true);
    expect(
      applyFilter(row, { column: "tags", operator: "contains", value: ["superuser"] }),
    ).toBe(false);
  });

  it("contains – object subset", () => {
    expect(
      applyFilter(row, {
        column: "meta",
        operator: "contains",
        value: { role: "admin" },
      }),
    ).toBe(true);
    expect(
      applyFilter(row, {
        column: "meta",
        operator: "contains",
        value: { role: "user" },
      }),
    ).toBe(false);
  });

  it("containedBy", () => {
    expect(
      applyFilter(row, {
        column: "tags",
        operator: "containedBy",
        value: ["admin", "user", "mod"],
      }),
    ).toBe(true);
    expect(
      applyFilter(row, { column: "tags", operator: "containedBy", value: ["admin"] }),
    ).toBe(false);
  });

  it("overlaps", () => {
    expect(
      applyFilter(row, {
        column: "tags",
        operator: "overlaps",
        value: ["admin", "superuser"],
      }),
    ).toBe(true);
    expect(
      applyFilter(row, { column: "tags", operator: "overlaps", value: ["superuser"] }),
    ).toBe(false);
  });

  it("match – full-text substring", () => {
    expect(applyFilter(row, { column: "name", operator: "match", value: "lic" })).toBe(
      true,
    );
    expect(applyFilter(row, { column: "name", operator: "match", value: "xyz" })).toBe(
      false,
    );
  });

  it("not – negation", () => {
    expect(applyFilter(row, { column: "name", operator: "not", value: "Bob" })).toBe(
      true,
    );
    expect(applyFilter(row, { column: "name", operator: "not", value: "Alice" })).toBe(
      false,
    );
  });
});

describe("applyFilter – OrNode / AndNode", () => {
  it("or – passes when any branch matches", () => {
    const f: OrNode = {
      type: "or",
      filters: [
        { column: "name", operator: "eq", value: "Alice" },
        { column: "name", operator: "eq", value: "Bob" },
      ],
    };
    expect(applyFilter(row, f)).toBe(true);
  });

  it("or – fails when no branch matches", () => {
    const f: OrNode = {
      type: "or",
      filters: [
        { column: "name", operator: "eq", value: "Bob" },
        { column: "name", operator: "eq", value: "Charlie" },
      ],
    };
    expect(applyFilter(row, f)).toBe(false);
  });

  it("and – passes when all branches match", () => {
    const f: AndNode = {
      type: "and",
      filters: [
        { column: "name", operator: "eq", value: "Alice" },
        { column: "age", operator: "gte", value: 18 },
      ],
    };
    expect(applyFilter(row, f)).toBe(true);
  });

  it("and – fails when any branch fails", () => {
    const f: AndNode = {
      type: "and",
      filters: [
        { column: "name", operator: "eq", value: "Alice" },
        { column: "age", operator: "gt", value: 100 },
      ],
    };
    expect(applyFilter(row, f)).toBe(false);
  });

  it("nested or inside and", () => {
    const f: AndNode = {
      type: "and",
      filters: [
        { column: "active", operator: "is", value: true },
        {
          type: "or",
          filters: [
            { column: "age", operator: "lt", value: 20 },
            { column: "age", operator: "gt", value: 25 },
          ],
        },
      ],
    };
    expect(applyFilter(row, f)).toBe(true);
  });

  it("not node — negates its child filter", () => {
    expect(
      applyFilter(row, {
        type: "not",
        filter: { column: "name", operator: "eq", value: "Bob" },
      }),
    ).toBe(true);
    expect(
      applyFilter(row, {
        type: "not",
        filter: { column: "name", operator: "eq", value: "Alice" },
      }),
    ).toBe(false);
  });

  it("not node — negates a nested or", () => {
    const f = {
      type: "not" as const,
      filter: {
        type: "or" as const,
        filters: [
          { column: "name", operator: "eq" as const, value: "Bob" },
          { column: "age", operator: "gt" as const, value: 100 },
        ],
      },
    };
    // Neither branch matches Alice/30, so the OR is false and NOT(false)=true.
    expect(applyFilter(row, f)).toBe(true);
  });

  it("empty and — vacuously true; empty or — vacuously false", () => {
    expect(applyFilter(row, { type: "and", filters: [] })).toBe(true);
    expect(applyFilter(row, { type: "or", filters: [] })).toBe(false);
  });
});

describe("parseOrString", () => {
  it("parses a simple string into an OrNode", () => {
    const node = parseOrString("name.eq.alice,age.gt.18");
    expect(node.type).toBe("or");
    expect(node.filters).toHaveLength(2);
    const [f1, f2] = node.filters as FilterNode[];
    expect(f1?.column).toBe("name");
    expect(f1?.operator).toBe("eq");
    expect(f1?.value).toBe("alice");
    expect(f2?.column).toBe("age");
    expect(f2?.operator).toBe("gt");
    expect(f2?.value).toBe(18);
  });

  it("handles null values", () => {
    const node = parseOrString("parent_id.is.null");
    const [f] = node.filters as FilterNode[];
    expect(f?.value).toBeNull();
  });
});
