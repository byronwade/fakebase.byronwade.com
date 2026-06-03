import { describe, expect, it } from "vitest";
import type { ProjectSchemaIR, TableIR } from "@byronwade/core";
import { orderTables } from "../order.js";

function table(
  name: string,
  refs: Record<string, string> = {},
): TableIR {
  return {
    schema: "public",
    name,
    primaryKey: "id",
    rlsEnabled: false,
    indexes: [],
    policies: [],
    columns: [
      { name: "id", type: "uuid", nullable: false, primaryKey: true },
      ...Object.entries(refs).map(([col, target]) => ({
        name: col,
        type: "uuid" as const,
        nullable: true,
        references: { table: target, column: "id" },
      })),
    ],
  };
}

function schema(...tables: TableIR[]): ProjectSchemaIR {
  return { tables, enums: [], functions: [], version: 1 };
}

const names = (tables: TableIR[]) => tables.map((t) => t.name);

describe("orderTables", () => {
  it("orders referenced (parent) tables before referencing (child) tables", () => {
    const s = schema(
      table("comments", { post_id: "posts" }),
      table("posts", { author_id: "users" }),
      table("users"),
    );
    const ordered = names(orderTables(s));
    expect(ordered.indexOf("users")).toBeLessThan(ordered.indexOf("posts"));
    expect(ordered.indexOf("posts")).toBeLessThan(ordered.indexOf("comments"));
  });

  it("includes every table exactly once", () => {
    const s = schema(table("a"), table("b", { a_id: "a" }), table("c"));
    expect(names(orderTables(s)).sort()).toEqual(["a", "b", "c"]);
  });

  it("does not loop on a self-reference", () => {
    const s = schema(table("employees", { manager_id: "employees" }));
    expect(names(orderTables(s))).toEqual(["employees"]);
  });

  it("terminates on a reference cycle, including each table once", () => {
    const s = schema(table("a", { b_id: "b" }), table("b", { a_id: "a" }));
    expect(names(orderTables(s)).sort()).toEqual(["a", "b"]);
  });
});
