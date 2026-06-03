import type { FakebaseClient } from "fakebase";
import type { Database } from "@/database.types";

/**
 * Seed script run by `fakebase seed run`. Receives a Fakebase client bound to
 * the local adapter. Keep this idempotent where possible.
 */
export default async function seed(supabase: FakebaseClient<Database>) {
  await supabase.from("notes").insert([
    {
      title: "Read the migration guide",
      content: "docs/migration-guide.md walks through the swap to real Supabase.",
      done: false,
    },
    {
      title: "Try the admin UI",
      content: "Run `fakebase studio` to browse and edit local data.",
      done: false,
    },
  ]);
}
