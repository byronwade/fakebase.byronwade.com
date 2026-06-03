import { describe, it, expect } from "vitest";
import type { ProjectSchemaIR } from "@fakebase/core";
import { diffSchemas, diffToSql, isSchemaDiffEmpty } from "../diff.js";

function makeSchema(overrides: Partial<ProjectSchemaIR> = {}): ProjectSchemaIR {
  return {
    version: 1,
    tables: [],
    enums: [],
    functions: [],
    ...overrides,
  };
}

const BASE_TABLE = {
  schema: "public",
  name: "users",
  primaryKey: "id",
  rlsEnabled: false,
  indexes: [],
  policies: [],
  columns: [
    { name: "id", type: "uuid" as const, nullable: false, primaryKey: true },
    { name: "email", type: "text" as const, nullable: false },
  ],
};

describe("diffSchemas – addedTables", () => {
  it("detects a new table", () => {
    const before = makeSchema();
    const after = makeSchema({ tables: [{ ...BASE_TABLE }] });
    const diff = diffSchemas(before, after);
    expect(diff.addedTables).toHaveLength(1);
    expect(diff.addedTables[0]!.name).toBe("users");
  });

  it("returns empty diff when schemas are identical", () => {
    const s = makeSchema({ tables: [{ ...BASE_TABLE }] });
    const diff = diffSchemas(s, s);
    expect(isSchemaDiffEmpty(diff)).toBe(true);
  });
});

describe("diffSchemas – removedTables", () => {
  it("detects a removed table", () => {
    const before = makeSchema({ tables: [{ ...BASE_TABLE }] });
    const after = makeSchema();
    const diff = diffSchemas(before, after);
    expect(diff.removedTables).toHaveLength(1);
    expect(diff.removedTables[0]!.name).toBe("users");
  });
});

describe("diffSchemas – modifiedTables", () => {
  it("detects an added column", () => {
    const before = makeSchema({ tables: [{ ...BASE_TABLE }] });
    const after = makeSchema({
      tables: [
        {
          ...BASE_TABLE,
          columns: [
            ...BASE_TABLE.columns,
            { name: "name", type: "text" as const, nullable: true },
          ],
        },
      ],
    });
    const diff = diffSchemas(before, after);
    expect(diff.modifiedTables).toHaveLength(1);
    expect(diff.modifiedTables[0]!.addedColumns[0]!.name).toBe("name");
  });

  it("detects a removed column", () => {
    const before = makeSchema({ tables: [{ ...BASE_TABLE }] });
    const after = makeSchema({
      tables: [{ ...BASE_TABLE, columns: [BASE_TABLE.columns[0]!] }],
    });
    const diff = diffSchemas(before, after);
    expect(diff.modifiedTables[0]!.removedColumns).toContain("email");
  });

  it("detects a modified column (nullable changed)", () => {
    const before = makeSchema({ tables: [{ ...BASE_TABLE }] });
    const after = makeSchema({
      tables: [
        {
          ...BASE_TABLE,
          columns: [
            BASE_TABLE.columns[0]!,
            { ...BASE_TABLE.columns[1]!, nullable: true },
          ],
        },
      ],
    });
    const diff = diffSchemas(before, after);
    expect(diff.modifiedTables[0]!.modifiedColumns[0]!.name).toBe("email");
  });

  it("detects RLS change", () => {
    const before = makeSchema({ tables: [{ ...BASE_TABLE }] });
    const after = makeSchema({
      tables: [{ ...BASE_TABLE, rlsEnabled: true }],
    });
    const diff = diffSchemas(before, after);
    expect(diff.modifiedTables[0]!.rlsChanged).toBe(true);
  });

  it("detects an added index", () => {
    const before = makeSchema({ tables: [{ ...BASE_TABLE }] });
    const after = makeSchema({
      tables: [
        {
          ...BASE_TABLE,
          indexes: [{ name: "users_email_idx", columns: ["email"], unique: true }],
        },
      ],
    });
    const diff = diffSchemas(before, after);
    expect(diff.modifiedTables[0]!.addedIndexes[0]!.name).toBe("users_email_idx");
  });

  it("detects a removed index", () => {
    const before = makeSchema({
      tables: [
        {
          ...BASE_TABLE,
          indexes: [{ name: "users_email_idx", columns: ["email"] }],
        },
      ],
    });
    const after = makeSchema({ tables: [{ ...BASE_TABLE }] });
    const diff = diffSchemas(before, after);
    expect(diff.modifiedTables[0]!.removedIndexes).toContain("users_email_idx");
  });
});

describe("diffSchemas – enums", () => {
  it("detects an added enum", () => {
    const before = makeSchema();
    const after = makeSchema({
      enums: [{ schema: "public", name: "status", values: ["active", "inactive"] }],
    });
    const diff = diffSchemas(before, after);
    expect(diff.addedEnums[0]!.name).toBe("status");
  });

  it("detects a removed enum", () => {
    const before = makeSchema({
      enums: [{ schema: "public", name: "status", values: ["active"] }],
    });
    const after = makeSchema();
    const diff = diffSchemas(before, after);
    expect(diff.removedEnums[0]!.name).toBe("status");
  });
});

describe("diffToSql", () => {
  it("generates CREATE TABLE for added tables", () => {
    const before = makeSchema();
    const after = makeSchema({ tables: [{ ...BASE_TABLE }] });
    const diff = diffSchemas(before, after);
    const sql = diffToSql(diff);
    expect(sql).toContain('create table if not exists "public"."users"');
  });

  it("generates DROP TABLE for removed tables", () => {
    const before = makeSchema({ tables: [{ ...BASE_TABLE }] });
    const after = makeSchema();
    const diff = diffSchemas(before, after);
    const sql = diffToSql(diff);
    expect(sql).toContain('drop table if exists "public"."users"');
  });

  it("generates ALTER TABLE ADD COLUMN for added columns", () => {
    const before = makeSchema({ tables: [{ ...BASE_TABLE }] });
    const after = makeSchema({
      tables: [
        {
          ...BASE_TABLE,
          columns: [
            ...BASE_TABLE.columns,
            { name: "bio", type: "text" as const, nullable: true },
          ],
        },
      ],
    });
    const diff = diffSchemas(before, after);
    const sql = diffToSql(diff);
    expect(sql).toContain('add column "bio" text');
  });

  it("generates ALTER TABLE DROP COLUMN for removed columns", () => {
    const before = makeSchema({ tables: [{ ...BASE_TABLE }] });
    const after = makeSchema({
      tables: [{ ...BASE_TABLE, columns: [BASE_TABLE.columns[0]!] }],
    });
    const diff = diffSchemas(before, after);
    const sql = diffToSql(diff);
    expect(sql).toContain('drop column "email"');
  });

  it("returns empty string for empty diff", () => {
    const s = makeSchema({ tables: [{ ...BASE_TABLE }] });
    const diff = diffSchemas(s, s);
    expect(diffToSql(diff)).toBe("");
  });
});

describe("isSchemaDiffEmpty", () => {
  it("returns true for identical schemas", () => {
    const s = makeSchema();
    expect(isSchemaDiffEmpty(diffSchemas(s, s))).toBe(true);
  });

  it("returns false when tables differ", () => {
    const before = makeSchema();
    const after = makeSchema({ tables: [{ ...BASE_TABLE }] });
    expect(isSchemaDiffEmpty(diffSchemas(before, after))).toBe(false);
  });
});
