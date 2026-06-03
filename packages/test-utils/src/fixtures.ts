import type { ProjectSchemaIR } from "@fakebase/core";

/**
 * Canonical test schema used by the contract suite and compat runner.
 * Contains two tables (users, posts) with an FK relationship and a sample enum.
 */
export const TEST_SCHEMA: ProjectSchemaIR = {
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
        { name: "email", type: "text", nullable: false, unique: true },
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
      indexes: [{ name: "users_email_idx", columns: ["email"], unique: true }],
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
        {
          name: "created_at",
          type: "timestamptz",
          nullable: false,
          defaultSql: "now()",
        },
      ],
      indexes: [{ name: "posts_user_id_idx", columns: ["user_id"] }],
      policies: [
        {
          name: "posts_owner_only",
          table: "posts",
          schema: "public",
          command: "ALL",
          roles: ["authenticated"],
          using: "auth.uid() = user_id",
          permissive: true,
        },
      ],
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

/** Seed rows that correspond to TEST_SCHEMA. */
export const TEST_SEEDS = {
  users: [
    {
      id: "user-1",
      email: "alice@example.com",
      name: "Alice",
      age: 30,
      role: "admin",
      metadata: null,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "user-2",
      email: "bob@example.com",
      name: "Bob",
      age: 25,
      role: "user",
      metadata: null,
      created_at: "2026-01-02T00:00:00Z",
    },
  ] as const,
  posts: [
    {
      id: "post-1",
      user_id: "user-1",
      title: "Hello world",
      body: "First post",
      published: true,
      created_at: "2026-01-03T00:00:00Z",
    },
    {
      id: "post-2",
      user_id: "user-2",
      title: "Bob's post",
      body: null,
      published: false,
      created_at: "2026-01-04T00:00:00Z",
    },
  ] as const,
};
