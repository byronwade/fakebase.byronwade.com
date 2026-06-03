/**
 * Runtime entry point: generate rows and insert them through a Supabase-shaped
 * client, in foreign-key-safe order. Idempotent — tables that already contain
 * rows are skipped, so it is safe to call on every boot.
 */

import type { ProjectSchemaIR } from "@byronwade/core";
import { generateRows, type GenerateOptions } from "./generate.js";
import { orderTables } from "./order.js";

/** The minimal slice of a Fakebase/Supabase client that seeding needs. */
interface SeedQuery {
  select(columns: string): {
    limit(n: number): PromiseLike<{ data: unknown[] | null; error: unknown }>;
  };
  insert(rows: Record<string, unknown>[]): PromiseLike<{ error: unknown }>;
}

export interface SeedableClient {
  from(table: string): SeedQuery;
  schema(name: string): { from(table: string): SeedQuery };
}

export interface SeedClientOptions extends GenerateOptions {
  /**
   * Insert into tables even if they already contain rows. Default false
   * (idempotent — existing data is left untouched).
   */
  force?: boolean;
}

export interface SeedResult {
  /** Rows inserted, keyed by table name. */
  inserted: Record<string, number>;
  /** Tables skipped because they already had rows. */
  skipped: string[];
}

export async function seedClient(
  client: SeedableClient,
  schema: ProjectSchemaIR,
  options: SeedClientOptions = {},
): Promise<SeedResult> {
  const generated = generateRows(schema, options);
  const inserted: Record<string, number> = {};
  const skipped: string[] = [];

  // Insert in FK order so parents exist before children reference them.
  for (const table of orderTables(schema)) {
    const rows = generated[`${table.schema}.${table.name}`] ?? [];
    if (rows.length === 0) continue;

    const query: SeedQuery =
      table.schema === "public"
        ? client.from(table.name)
        : client.schema(table.schema).from(table.name);

    if (!options.force) {
      const existing = await query.select("*").limit(1);
      if (existing.error) throw existing.error;
      if ((existing.data?.length ?? 0) > 0) {
        skipped.push(table.name);
        continue;
      }
    }

    const insertQuery: SeedQuery =
      table.schema === "public"
        ? client.from(table.name)
        : client.schema(table.schema).from(table.name);
    const { error } = await insertQuery.insert(rows);
    if (error) throw error;
    inserted[table.name] = rows.length;
  }

  return { inserted, skipped };
}
