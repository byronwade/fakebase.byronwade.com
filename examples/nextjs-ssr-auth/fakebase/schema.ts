import { schema } from "@fakebase/migrations";

// Auth users live in Fakebase's internal auth store, so this app schema only
// needs the application tables. A `profiles` row is created on sign-up.
export default schema({
  tables: {
    profiles: {
      columns: {
        id: { type: "uuid", primaryKey: true, default: "gen_random_uuid()" },
        user_id: { type: "uuid", nullable: false, unique: true },
        email: { type: "text", nullable: false },
        created_at: { type: "timestamptz", nullable: false, default: "now()" },
      },
    },
  },
  enums: {},
});
