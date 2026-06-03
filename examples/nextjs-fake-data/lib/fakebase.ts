// Server-only: the kernel uses Node built-ins (fs/crypto).
import "server-only";
import { createClient, createMemoryKernel } from "fakebase";
import { seedClient } from "@fakebase/seed";
import appSchema from "@/fakebase/schema";
import type { Database } from "@/database.types";

const kernel = createMemoryKernel<Database>(appSchema);

export const supabase = createClient<Database>("local", "dev-key", { kernel });

// This is the whole "seeding" story for this app — no seed file. `@fakebase/seed`
// reads the schema and generates realistic, foreign-key-correct rows: 5 users
// and 12 posts, each post authored by a real user. Deterministic (fixed seed)
// and idempotent (skips tables that already have rows).
await seedClient(supabase, appSchema, {
  seed: 42,
  tables: { users: 5, posts: 12 },
});
