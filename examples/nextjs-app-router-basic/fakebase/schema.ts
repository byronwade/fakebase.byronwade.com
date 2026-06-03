import { schema } from "@fakebase/migrations";

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
