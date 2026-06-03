import { schema } from "@fakebase/migrations";

export default schema({
  tables: {
    // Realtime demo: inserts here are streamed to the browser over SSE.
    events: {
      columns: {
        id: { type: "uuid", primaryKey: true, default: "gen_random_uuid()" },
        message: { type: "text", nullable: false },
        created_at: { type: "timestamptz", nullable: false, default: "now()" },
      },
    },
  },
  enums: {},
});
