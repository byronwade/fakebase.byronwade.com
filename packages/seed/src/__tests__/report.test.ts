import { describe, expect, it } from "vitest";
import type { ProjectSchemaIR } from "@fakebase/core";
import { describeResolution } from "../report.js";

const SCHEMA: ProjectSchemaIR = {
  version: 1,
  functions: [],
  enums: [{ schema: "public", name: "post_status", values: ["draft", "live"] }],
  tables: [
    {
      schema: "public",
      name: "users",
      primaryKey: "id",
      rlsEnabled: false,
      indexes: [],
      policies: [],
      columns: [
        { name: "id", type: "uuid", nullable: false, primaryKey: true },
        { name: "email", type: "text", nullable: false },
        { name: "created_at", type: "timestamptz", nullable: false, defaultSql: "now()" },
        { name: "blob", type: "bytea", nullable: true },
      ],
    },
    {
      schema: "public",
      name: "posts",
      primaryKey: "id",
      rlsEnabled: false,
      indexes: [],
      policies: [],
      columns: [
        { name: "id", type: "uuid", nullable: false, primaryKey: true },
        {
          name: "author_id",
          type: "uuid",
          nullable: false,
          references: { table: "users", column: "id" },
        },
        { name: "status", type: "post_status", nullable: false },
      ],
    },
  ],
};

const find = (
  report: ReturnType<typeof describeResolution>,
  table: string,
  column: string,
) => report.find((r) => r.table === table && r.column === column)!;

describe("describeResolution", () => {
  it("labels primary keys", () => {
    expect(find(describeResolution(SCHEMA), "users", "id").strategy).toBe(
      "primary-key",
    );
  });

  it("labels skipped (defaulted/generated) columns", () => {
    expect(find(describeResolution(SCHEMA), "users", "created_at").strategy).toBe(
      "skipped",
    );
  });

  it("labels foreign keys", () => {
    expect(find(describeResolution(SCHEMA), "posts", "author_id").strategy).toBe(
      "foreign-key",
    );
  });

  it("labels enums", () => {
    expect(find(describeResolution(SCHEMA), "posts", "status").strategy).toBe(
      "enum",
    );
  });

  it("labels semantic name matches", () => {
    expect(find(describeResolution(SCHEMA), "users", "email").strategy).toBe(
      "semantic",
    );
  });

  it("labels raw type fallbacks (no semantic match)", () => {
    expect(find(describeResolution(SCHEMA), "users", "blob").strategy).toBe(
      "type",
    );
  });

  it("marks an overridden column", () => {
    const report = describeResolution(SCHEMA, {
      overrides: { "posts.status": () => "draft" },
    });
    expect(find(report, "posts", "status").strategy).toBe("override");
  });
});
