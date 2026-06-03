import { describe, it, expect } from "vitest";
import { schema, parseTypescriptSchema, parseSqlSchema } from "../schema-parser.js";

// ---------------------------------------------------------------------------
// schema() DSL helper
// ---------------------------------------------------------------------------

describe("schema() DSL helper", () => {
  it("converts a simple table definition into a ProjectSchemaIR", () => {
    const ir = schema({
      tables: {
        profiles: {
          columns: {
            id: { type: "uuid", primaryKey: true, default: "gen_random_uuid()" },
            username: { type: "text", nullable: false },
          },
        },
      },
      enums: {},
    });

    expect(ir.tables).toHaveLength(1);
    expect(ir.tables[0]!.name).toBe("profiles");
    expect(ir.tables[0]!.primaryKey).toBe("id");
  });

  it("sets nullable=false when primaryKey=true even if nullable is not specified", () => {
    const ir = schema({
      tables: {
        t: {
          columns: {
            id: { type: "uuid", primaryKey: true },
          },
        },
      },
      enums: {},
    });
    expect(ir.tables[0]!.columns[0]!.nullable).toBe(false);
  });

  it("sets nullable=true by default for non-PK columns without nullable specified", () => {
    const ir = schema({
      tables: {
        t: {
          columns: {
            id: { type: "uuid", primaryKey: true },
            name: { type: "text" },
          },
        },
      },
      enums: {},
    });
    expect(ir.tables[0]!.columns[1]!.nullable).toBe(true);
  });

  it("respects nullable:false on regular columns", () => {
    const ir = schema({
      tables: {
        t: {
          columns: {
            id: { type: "uuid", primaryKey: true },
            email: { type: "text", nullable: false },
          },
        },
      },
      enums: {},
    });
    expect(ir.tables[0]!.columns[1]!.nullable).toBe(false);
  });

  it("converts enums", () => {
    const ir = schema({
      tables: {},
      enums: { user_role: { values: ["admin", "user"] } },
    });
    expect(ir.enums).toHaveLength(1);
    expect(ir.enums[0]!.name).toBe("user_role");
    expect(ir.enums[0]!.values).toEqual(["admin", "user"]);
  });

  it("sets rlsEnabled from the rls field", () => {
    const ir = schema({
      tables: {
        posts: { rls: true, columns: { id: { type: "uuid", primaryKey: true } } },
      },
      enums: {},
    });
    expect(ir.tables[0]!.rlsEnabled).toBe(true);
  });

  it("stores defaultSql from the default field", () => {
    const ir = schema({
      tables: {
        t: {
          columns: {
            id: { type: "uuid", primaryKey: true, default: "gen_random_uuid()" },
            created_at: { type: "timestamptz", default: "now()" },
          },
        },
      },
      enums: {},
    });
    expect(ir.tables[0]!.columns[0]!.defaultSql).toBe("gen_random_uuid()");
    expect(ir.tables[0]!.columns[1]!.defaultSql).toBe("now()");
  });

  it("stores unique constraint", () => {
    const ir = schema({
      tables: {
        t: {
          columns: {
            id: { type: "uuid", primaryKey: true },
            email: { type: "text", nullable: false, unique: true },
          },
        },
      },
      enums: {},
    });
    expect(ir.tables[0]!.columns[1]!.unique).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseTypescriptSchema()
// ---------------------------------------------------------------------------

describe("parseTypescriptSchema()", () => {
  const source = `
import { schema } from "@byronwade/migrations";

export default schema({
  tables: {
    profiles: {
      columns: {
        id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
        username: { type: 'text', nullable: false },
        email: { type: 'text', nullable: false, unique: true },
        created_at: { type: 'timestamptz', default: 'now()' },
      },
      rls: true,
    },
  },
  enums: {},
});
  `;

  it("returns a valid ProjectSchemaIR", () => {
    const ir = parseTypescriptSchema(source);
    expect(ir).toBeDefined();
    expect(ir.tables).toHaveLength(1);
  });

  it("extracts the table name", () => {
    const ir = parseTypescriptSchema(source);
    expect(ir.tables[0]!.name).toBe("profiles");
  });

  it("extracts all columns", () => {
    const ir = parseTypescriptSchema(source);
    expect(ir.tables[0]!.columns).toHaveLength(4);
  });

  it("identifies the primary key column", () => {
    const ir = parseTypescriptSchema(source);
    expect(ir.tables[0]!.primaryKey).toBe("id");
    const idCol = ir.tables[0]!.columns.find((c) => c.name === "id");
    expect(idCol?.primaryKey).toBe(true);
    expect(idCol?.nullable).toBe(false);
  });

  it("picks up unique constraint", () => {
    const ir = parseTypescriptSchema(source);
    const emailCol = ir.tables[0]!.columns.find((c) => c.name === "email");
    expect(emailCol?.unique).toBe(true);
  });

  it("picks up rls:true", () => {
    const ir = parseTypescriptSchema(source);
    expect(ir.tables[0]!.rlsEnabled).toBe(true);
  });

  it("picks up defaultSql", () => {
    const ir = parseTypescriptSchema(source);
    const idCol = ir.tables[0]!.columns.find((c) => c.name === "id");
    expect(idCol?.defaultSql).toBe("gen_random_uuid()");
  });

  it("throws on invalid source", () => {
    expect(() => parseTypescriptSchema("this is not valid schema code {{{{")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// parseSqlSchema()
// ---------------------------------------------------------------------------

describe("parseSqlSchema()", () => {
  const sql = `
create table if not exists "public"."users" (
  "id" uuid not null primary key default gen_random_uuid(),
  "email" text not null unique,
  "name" text,
  "age" integer,
  "created_at" timestamptz not null default now()
);

create table if not exists "public"."posts" (
  "id" uuid not null primary key default gen_random_uuid(),
  "user_id" uuid not null references "users"("id"),
  "title" text not null,
  "published" boolean not null default false
);

create unique index if not exists "users_email_idx" on "public"."users" ("email");
  `;

  it("parses all CREATE TABLE statements", () => {
    const partial = parseSqlSchema(sql);
    expect(partial.tables).toHaveLength(2);
  });

  it("extracts CREATE TYPE ... AS ENUM definitions", () => {
    const enumSql = `
      create type "public"."post_status" as enum ('draft', 'published', 'archived');
      create table "posts" ( "id" uuid primary key, "status" post_status not null );
    `;
    const partial = parseSqlSchema(enumSql);
    expect(partial.enums).toHaveLength(1);
    expect(partial.enums![0]).toEqual({
      schema: "public",
      name: "post_status",
      values: ["draft", "published", "archived"],
    });
  });

  it("extracts column names", () => {
    const partial = parseSqlSchema(sql);
    const users = partial.tables!.find((t) => t.name === "users");
    expect(users?.columns.map((c) => c.name)).toContain("email");
  });

  it("maps SQL types back to IR types", () => {
    const partial = parseSqlSchema(sql);
    const users = partial.tables!.find((t) => t.name === "users");
    const ageCol = users?.columns.find((c) => c.name === "age");
    expect(ageCol?.type).toBe("int4");
  });

  it("detects NOT NULL", () => {
    const partial = parseSqlSchema(sql);
    const users = partial.tables!.find((t) => t.name === "users");
    const emailCol = users?.columns.find((c) => c.name === "email");
    expect(emailCol?.nullable).toBe(false);
  });

  it("detects PRIMARY KEY", () => {
    const partial = parseSqlSchema(sql);
    const users = partial.tables!.find((t) => t.name === "users");
    const idCol = users?.columns.find((c) => c.name === "id");
    expect(idCol?.primaryKey).toBe(true);
  });

  it("detects REFERENCES (foreign key)", () => {
    const partial = parseSqlSchema(sql);
    const posts = partial.tables!.find((t) => t.name === "posts");
    const userIdCol = posts?.columns.find((c) => c.name === "user_id");
    expect(userIdCol?.references?.table).toBe("users");
  });

  it("parses CREATE INDEX and attaches to table", () => {
    const partial = parseSqlSchema(sql);
    const users = partial.tables!.find((t) => t.name === "users");
    expect(users?.indexes).toHaveLength(1);
    expect(users?.indexes[0]!.name).toBe("users_email_idx");
    expect(users?.indexes[0]!.unique).toBe(true);
  });
});
