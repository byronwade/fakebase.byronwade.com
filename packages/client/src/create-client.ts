/**
 * `createClient` — the primary entry point for application code.
 *
 * Drop-in replacement for `createClient` from `@supabase/supabase-js`:
 * ```diff
 * - import { createClient } from '@supabase/supabase-js';
 * + import { createClient } from 'fakebase';
 * ```
 */

import { DatabaseBuilder } from "./database-builder.js";
import { createAuthClient } from "./auth-client.js";
import { createStorageClient } from "./storage-client.js";
import {
  createRealtimeClient,
  type Channel,
  type RealtimeClientFacade,
} from "./realtime-client.js";
import { createFunctionsClient } from "./functions-client.js";
import type { FakebaseKernel } from "@fakebase/core";
import type { AuthClientFacade } from "./auth-client.js";
import type { StorageClientFacade } from "./storage-client.js";
import type { FunctionsClientFacade } from "./functions-client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options accepted by `createClient`.
 *
 * @typeParam Database - Optional codegen database type for full type inference.
 */
export interface FakebaseClientOptions<
  Database = Record<string, Record<string, unknown>>,
> {
  /**
   * The kernel that backs this client instance.
   * Use `createMemoryKernel()` from `@fakebase/adapter-memory` for local dev.
   */
  kernel: FakebaseKernel;
  /**
   * Default Postgres schema for `from()` calls.
   * @default "public"
   */
  schema?: string;
  auth?: {
    persistSession?: boolean;
    autoRefreshToken?: boolean;
    detectSessionInUrl?: boolean;
    storageKey?: string;
  };
  global?: {
    headers?: Record<string, string>;
  };
  /** Suppress unused-variable warnings for _Database. */
  _phantom?: Database;
}

/**
 * The fully assembled Fakebase client.
 * Mirrors the `SupabaseClient` surface from `@supabase/supabase-js`.
 */
export interface FakebaseClient<
  Database = Record<string, Record<string, unknown>>,
  SchemaName extends string = "public",
> {
  /**
   * Build a query against a table in the default schema.
   *
   * @example
   * const { data } = await db.from('users').select('id, name').eq('active', true);
   */
  from<TableName extends string>(
    table: TableName,
  ): DatabaseBuilder<Database, SchemaName, TableName>;

  /**
   * Switch to a non-default schema before calling `from()`.
   *
   * @example
   * const { data } = await db.schema('analytics').from('events').select();
   */
  schema<S extends string>(
    schemaName: S,
  ): {
    from<TableName extends string>(
      table: TableName,
    ): DatabaseBuilder<Database, S, TableName>;
  };

  /** Auth client — mirrors `supabase.auth`. */
  auth: AuthClientFacade;

  /** Storage client — mirrors `supabase.storage`. */
  storage: StorageClientFacade;

  /** Realtime client — mirrors `supabase.realtime`. */
  realtime: RealtimeClientFacade;

  /** Functions client — mirrors `supabase.functions`. */
  functions: FunctionsClientFacade;

  /**
   * Create (or reuse) a named realtime channel.
   * Shorthand for `client.realtime.channel(name)`.
   */
  channel(name: string, options?: Record<string, unknown>): Channel;

  /**
   * Remove a specific channel.
   * Shorthand for `client.realtime.removeChannel(ch)`.
   */
  removeChannel(channel: Channel): Promise<"error" | "timed out" | "ok">;

  /**
   * Remove all realtime channels.
   * Shorthand for `client.realtime.removeAllChannels()`.
   */
  removeAllChannels(): Promise<("error" | "timed out" | "ok")[]>;

  /**
   * Return all active realtime channels.
   * Shorthand for `client.realtime.getChannels()`.
   */
  getChannels(): Channel[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new Fakebase client instance.
 *
 * The `url` and `key` parameters exist solely for API parity with
 * `@supabase/supabase-js` — they are intentionally ignored. All data
 * operations go through the `kernel` option.
 *
 * @param _url  - Ignored; present for API compatibility.
 * @param _key  - Ignored; present for API compatibility.
 * @param options - Client configuration, including the required `kernel`.
 *
 * @example
 * ```ts
 * import { createClient, createMemoryKernel } from 'fakebase';
 *
 * const kernel = createMemoryKernel({ tables: [], enums: [], functions: [], version: 0 });
 * const db = createClient<MyDatabase>('http://localhost', 'anon-key', { kernel });
 *
 * const { data, error } = await db.from('users').select('*').eq('role', 'admin');
 * ```
 */
export function createClient<
  Database = Record<string, Record<string, unknown>>,
  SchemaName extends string = "public",
>(
  _url: string,
  _key: string,
  options: FakebaseClientOptions<Database>,
): FakebaseClient<Database, SchemaName> {
  const { kernel, schema = "public" as SchemaName } = options;

  const authFacade = createAuthClient(kernel);
  const storageFacade = createStorageClient(kernel);
  const realtimeFacade = createRealtimeClient(kernel);
  const functionsFacade = createFunctionsClient(kernel);

  return {
    from<TableName extends string>(
      table: TableName,
    ): DatabaseBuilder<Database, SchemaName, TableName> {
      return new DatabaseBuilder<Database, SchemaName, TableName>(
        kernel,
        table,
        schema,
      );
    },

    schema<S extends string>(schemaName: S) {
      return {
        from<TableName extends string>(
          table: TableName,
        ): DatabaseBuilder<Database, S, TableName> {
          return new DatabaseBuilder<Database, S, TableName>(kernel, table, schemaName);
        },
      };
    },

    auth: authFacade,
    storage: storageFacade,
    realtime: realtimeFacade,
    functions: functionsFacade,

    channel: (name, opts) => realtimeFacade.channel(name, opts),
    removeChannel: (ch) => realtimeFacade.removeChannel(ch),
    removeAllChannels: () => realtimeFacade.removeAllChannels(),
    getChannels: () => realtimeFacade.getChannels(),
  };
}
