/**
 * Admin client setup — creates a Fakebase client backed by the JSON adapter
 * pointing at the `.fakebase/` data directory.
 *
 * In the admin UI this is a singleton used for all data operations.
 */

import type { ProjectSchemaIR } from "@fakebase/core";

/** Placeholder schema used when no real schema file is found. */
const emptySchema: ProjectSchemaIR = {
  version: 0,
  tables: [],
  enums: [],
  functions: [],
};

/**
 * Returns a minimal admin client configuration.
 *
 * In a real integration this would instantiate a JsonAdapter, load the schema
 * from `.fakebase/schema.json`, and wire up the full kernel. Since the admin UI
 * is a browser-side Next.js app, heavy file I/O happens via API routes rather
 * than directly.
 */
export function getAdminClientConfig() {
  return {
    dataDir: ".fakebase",
    schema: emptySchema,
  };
}

/** The data directory where Fakebase stores JSON snapshots. */
export const FAKEBASE_DATA_DIR = ".fakebase";
