/**
 * Schema IR + seed data for the live playground. Ported from the standalone
 * playground app. A blog-shaped schema: users + posts + comments.
 */
import type { ProjectSchemaIR } from "@byronwade/fakebase";

export const DEMO_USER_ID = "11111111-1111-4111-8111-111111111111";

export const playgroundSchema: ProjectSchemaIR = {
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
      indexes: [{ name: "users_username_idx", columns: ["username"], unique: true }],
      columns: [
        {
          name: "id",
          type: "uuid",
          nullable: false,
          primaryKey: true,
          defaultSql: "gen_random_uuid()",
        },
        { name: "email", type: "text", nullable: false, unique: true },
        { name: "username", type: "text", nullable: false },
        { name: "display_name", type: "text", nullable: true },
        { name: "avatar_url", type: "text", nullable: true },
        { name: "bio", type: "text", nullable: true },
        {
          name: "created_at",
          type: "timestamptz",
          nullable: false,
          defaultSql: "now()",
        },
        {
          name: "updated_at",
          type: "timestamptz",
          nullable: false,
          defaultSql: "now()",
        },
      ],
    },
    {
      schema: "public",
      name: "posts",
      primaryKey: "id",
      rlsEnabled: false,
      policies: [],
      indexes: [{ name: "posts_user_id_idx", columns: ["user_id"] }],
      columns: [
        {
          name: "id",
          type: "uuid",
          nullable: false,
          primaryKey: true,
          defaultSql: "gen_random_uuid()",
        },
        { name: "title", type: "text", nullable: false },
        { name: "body", type: "text", nullable: false },
        {
          name: "user_id",
          type: "uuid",
          nullable: false,
          references: { table: "users", column: "id" },
        },
        { name: "published", type: "bool", nullable: false, defaultSql: "false" },
        { name: "slug", type: "text", nullable: true },
        { name: "tags", type: "jsonb", nullable: true },
        { name: "view_count", type: "int4", nullable: false, defaultSql: "0" },
        {
          name: "created_at",
          type: "timestamptz",
          nullable: false,
          defaultSql: "now()",
        },
        {
          name: "updated_at",
          type: "timestamptz",
          nullable: false,
          defaultSql: "now()",
        },
      ],
    },
    {
      schema: "public",
      name: "comments",
      primaryKey: "id",
      rlsEnabled: false,
      policies: [],
      indexes: [{ name: "comments_post_id_idx", columns: ["post_id"] }],
      columns: [
        {
          name: "id",
          type: "uuid",
          nullable: false,
          primaryKey: true,
          defaultSql: "gen_random_uuid()",
        },
        {
          name: "post_id",
          type: "uuid",
          nullable: false,
          references: { table: "posts", column: "id" },
        },
        {
          name: "user_id",
          type: "uuid",
          nullable: false,
          references: { table: "users", column: "id" },
        },
        { name: "body", type: "text", nullable: false },
        {
          name: "created_at",
          type: "timestamptz",
          nullable: false,
          defaultSql: "now()",
        },
      ],
    },
  ],
};

/** Starter content so a freshly-seeded sandbox isn't empty. */
export const playgroundSeed: Record<string, Record<string, unknown>[]> = {
  "public.users": [
    {
      id: DEMO_USER_ID,
      email: "dev@example.com",
      username: "devuser",
      display_name: "Dev User",
      avatar_url: null,
      bio: "Local Fakebase demo account.",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  "public.posts": [
    {
      id: "22222222-2222-4222-8222-222222222221",
      title: "Hello Fakebase",
      body: "This post is served entirely from a local in-memory adapter.",
      user_id: DEMO_USER_ID,
      published: true,
      slug: "hello-fakebase",
      tags: ["intro", "demo"],
      view_count: 12,
      created_at: "2026-01-02T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      title: "Swapping to real Supabase",
      body: "Export your schema and seeds, then point @supabase/supabase-js at your project.",
      user_id: DEMO_USER_ID,
      published: false,
      slug: "swapping-to-supabase",
      tags: ["migration"],
      view_count: 3,
      created_at: "2026-01-03T00:00:00.000Z",
      updated_at: "2026-01-03T00:00:00.000Z",
    },
  ],
};
