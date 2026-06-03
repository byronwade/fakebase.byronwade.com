import { schema } from "@fakebase/migrations";

/**
 * Canonical schema for this project, authored with the Fakebase DSL.
 *
 * This is the single source of truth used by:
 *   - the CLI (`fakebase types gen`, `fakebase migrate diff/export`)
 *   - the local kernel in `lib/fakebase.ts`
 *
 * When you're ready for production, run `fakebase migrate export --supabase`
 * to turn this into real `supabase/migrations/*.sql`.
 */
export default schema({
  tables: {
    notes: {
      columns: {
        id: { type: "uuid", primaryKey: true, default: "gen_random_uuid()" },
        title: { type: "text", nullable: false },
        content: { type: "text", nullable: true },
        done: { type: "bool", nullable: false, default: "false" },
        created_at: { type: "timestamptz", nullable: false, default: "now()" },
      },
    },
  },
  enums: {},
});
