import "server-only";
import { createClient, createMemoryKernel } from "fakebase";
import appSchema from "@/fakebase/schema";
import type { Database } from "@/database.types";

const kernel = createMemoryKernel<Database>(appSchema);

export const supabase = createClient<Database>("local", "dev-key", { kernel });

export const BUCKET_ID = "uploads";

let bucketReady = false;

/** Create the demo bucket once (idempotent). */
export async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  const { error } = await supabase.storage.createBucket(BUCKET_ID, {
    public: true,
  });
  if (error && !error.message?.includes("already exists")) {
    throw new Error(error.message);
  }
  bucketReady = true;
}
