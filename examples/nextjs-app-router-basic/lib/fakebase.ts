import "server-only";
import { createClient, createMemoryKernel } from "fakebase";
import appSchema from "@/fakebase/schema";
import type { Database } from "@/database.types";

const kernel = createMemoryKernel<Database>(appSchema);

kernel.restore({
  "public.notes": [
    {
      id: "11111111-1111-4111-8111-111111111111",
      title: "First note",
      content: "Created from the seed in lib/fakebase.ts.",
      done: false,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ],
});

export const supabase = createClient<Database>("local", "dev-key", { kernel });
