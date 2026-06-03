import { describe, it, expect } from "vitest";
import type { ProjectSchemaIR } from "@byronwade/core";
import { generateTypes } from "../generator.js";

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
        { name: "email", type: "text", nullable: false },
        { name: "name", type: "text", nullable: true },
        { name: "age", type: "int4", nullable: true },
        { name: "role", type: "text", nullable: false, defaultSql: "'user'" },
        { name: "metadata", type: "jsonb", nullable: true },
        {
          name: "created_at",
          type: "timestamptz",
          nullable: false,
          defaultSql: "now()",
        },
      ],
      indexes: [],
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
        { name: "body", type: "text", nullable: true },
        {
          name: "published",
          type: "bool",
          nullable: false,
          defaultSql: "false",
        },
      ],
      indexes: [],
      policies: [],
    },
  ],
  enums: [
    {
      schema: "public",
      name: "user_role",
      values: ["admin", "user", "moderator"],
    },
  ],
  functions: [],
};

describe("generateTypes", () => {
  it("produces output containing the Json type alias", () => {
    const output = generateTypes(SCHEMA);
    expect(output).toContain("export type Json =");
  });

  it("produces a Database type export", () => {
    const output = generateTypes(SCHEMA);
    expect(output).toContain("export type Database = {");
  });

  it("contains the Tables section with all table names", () => {
    const output = generateTypes(SCHEMA);
    expect(output).toContain("users:");
    expect(output).toContain("posts:");
  });

  it("maps uuid columns to string in Row type", () => {
    const output = generateTypes(SCHEMA);
    expect(output).toMatch(/id:\s*string/);
  });

  it("maps int4 columns to number in Row type", () => {
    const output = generateTypes(SCHEMA);
    expect(output).toMatch(/age:\s*number \| null/);
  });

  it("maps bool columns to boolean in Row type", () => {
    const output = generateTypes(SCHEMA);
    expect(output).toMatch(/published:\s*boolean/);
  });

  it("maps jsonb columns to Json in Row type", () => {
    const output = generateTypes(SCHEMA);
    expect(output).toMatch(/metadata:\s*Json \| null/);
  });

  it("makes nullable columns `T | null` in Row type", () => {
    const output = generateTypes(SCHEMA);
    expect(output).toMatch(/name:\s*string \| null/);
  });

  it("marks columns with defaultSql as optional (T | undefined → T?) in Insert type", () => {
    const output = generateTypes(SCHEMA);
    // id has defaultSql → should appear as id?: string in Insert
    expect(output).toMatch(/id\?:\s*string/);
  });

  it("marks columns without defaults as required in Insert type", () => {
    const output = generateTypes(SCHEMA);
    // email has no default and is not nullable → should be: email: string
    // Verify it doesn't have a ? next to email in the Insert block
    const insertStart = output.indexOf("Insert: {");
    const insertEnd = output.indexOf("};", insertStart);
    const insertBlock = output.slice(insertStart, insertEnd);
    // email should appear as required (no ?)
    expect(insertBlock).toMatch(/email: string/);
  });

  it("makes all columns optional in Update type", () => {
    const output = generateTypes(SCHEMA);
    const updateStart = output.indexOf("Update: {");
    const updateEnd = output.indexOf("};", updateStart);
    const updateBlock = output.slice(updateStart, updateEnd);
    // All columns should have ? in Update
    expect(updateBlock).toMatch(/email\?:/);
    expect(updateBlock).toMatch(/id\?:/);
  });

  it("includes Relationships for FK columns", () => {
    const output = generateTypes(SCHEMA);
    expect(output).toContain("posts_user_id_fkey");
    expect(output).toContain('"users"');
  });

  it("produces enum types", () => {
    const output = generateTypes(SCHEMA);
    expect(output).toContain("user_role:");
    expect(output).toContain('"admin"');
    expect(output).toContain('"user"');
    expect(output).toContain('"moderator"');
  });

  it("exports the Tables convenience type helper", () => {
    const output = generateTypes(SCHEMA);
    expect(output).toContain("export type Tables<");
    expect(output).toContain('Database["public"]["Tables"][T]["Row"]');
  });

  it("exports the TablesInsert convenience type helper", () => {
    const output = generateTypes(SCHEMA);
    expect(output).toContain("export type TablesInsert<");
    expect(output).toContain('Database["public"]["Tables"][T]["Insert"]');
  });

  it("exports the TablesUpdate convenience type helper", () => {
    const output = generateTypes(SCHEMA);
    expect(output).toContain("export type TablesUpdate<");
    expect(output).toContain('Database["public"]["Tables"][T]["Update"]');
  });

  it("exports the Enums convenience type helper", () => {
    const output = generateTypes(SCHEMA);
    expect(output).toContain("export type Enums<");
    expect(output).toContain('Database["public"]["Enums"][T]');
  });

  it("snapshot — output matches expected structure", () => {
    const output = generateTypes(SCHEMA);
    expect(output).toMatchSnapshot();
  });
});

describe("generateTypes — generated columns", () => {
  it("marks generated columns as `never` in Insert type", () => {
    const schema: ProjectSchemaIR = {
      version: 1,
      tables: [
        {
          schema: "public",
          name: "serial_table",
          primaryKey: "id",
          rlsEnabled: false,
          columns: [
            {
              name: "id",
              type: "serial",
              nullable: false,
              primaryKey: true,
              generated: true,
            },
            { name: "value", type: "text", nullable: false },
          ],
          indexes: [],
          policies: [],
        },
      ],
      enums: [],
      functions: [],
    };

    const output = generateTypes(schema);
    const insertStart = output.indexOf("Insert: {");
    const insertEnd = output.indexOf("};", insertStart);
    const insertBlock = output.slice(insertStart, insertEnd);
    expect(insertBlock).toMatch(/id\?:\s*never/);
  });
});
