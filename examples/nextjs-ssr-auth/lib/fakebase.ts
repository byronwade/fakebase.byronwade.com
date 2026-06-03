import "server-only";
import { createClient, createMemoryKernel } from "fakebase";
import appSchema from "@/fakebase/schema";
import type { Database } from "@/database.types";

const kernel = createMemoryKernel<Database>(appSchema);

export const supabase = createClient<Database>("local", "dev-key", { kernel });
