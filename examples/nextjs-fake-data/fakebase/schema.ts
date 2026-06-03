import { schema } from "@fakebase/migrations";

/**
 * A small blog schema. Notice there is NO seed file anywhere in this project —
 * `@fakebase/seed` fills every column from the shapes below: `email` → an email,
 * `avatar_url` → an avatar, `author_id` → a real user row, etc.
 */
export default schema({
  tables: {
    users: {
      columns: {
        id: { type: "uuid", primaryKey: true, default: "gen_random_uuid()" },
        email: { type: "text", nullable: false, unique: true },
        first_name: { type: "text", nullable: false },
        last_name: { type: "text", nullable: false },
        avatar_url: { type: "text", nullable: true },
        created_at: { type: "timestamptz", nullable: false, default: "now()" },
      },
    },
    posts: {
      columns: {
        id: { type: "uuid", primaryKey: true, default: "gen_random_uuid()" },
        title: { type: "text", nullable: false },
        excerpt: { type: "text", nullable: false },
        author_id: {
          type: "uuid",
          nullable: false,
          references: { table: "users", column: "id" },
        },
        view_count: { type: "int4", nullable: false },
        published: { type: "bool", nullable: false, default: "false" },
        created_at: { type: "timestamptz", nullable: false, default: "now()" },
      },
    },
  },
  enums: {},
});
