/**
 * Fakebase client singleton.
 *
 * Mirrors the @supabase/supabase-js pattern:
 *   import { createClient } from "@supabase/supabase-js";
 *   export const supabase = createClient(url, key);
 *
 * ⚠️  LOCAL DEV ONLY — replace with real Supabase before deploying.
 */

// The kernel is backed by Node built-ins (fs/path/crypto), so it must only run
// on the server. Import this module from Server Components, Route Handlers, and
// Server Actions — never from Client Components.
import "server-only";
import { createClient, createMemoryKernel } from "fakebase";
import { seedClient } from "@fakebase/seed";
import appSchema from "@/fakebase/schema";
import type { Database } from "@/database.types";

const kernel = createMemoryKernel<Database>(appSchema);

export const supabase = createClient<Database>("local", "dev-key", { kernel });

// Fill the database with realistic, schema-derived fake data so the app isn't
// empty on first load — no hand-written seed file. Deterministic and idempotent
// (skips tables that already have rows). Tune or remove once you have your own
// data. See https://github.com/byronwade/fakebase/blob/main/docs/seeding.md
await seedClient(supabase, appSchema, { rowsPerTable: 5 });
