/**
 * Shared CLI runtime helpers — schema loading and kernel construction.
 *
 * These wrap the package factories so individual commands don't duplicate the
 * (slightly fiddly) logic of finding the project schema and wiring an adapter.
 */

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FakebaseKernel, ProjectSchemaIR } from "@byronwade/core";
import type { FakebaseConfig } from "./config.js";

const EMPTY_SCHEMA: ProjectSchemaIR = {
  version: 0,
  tables: [],
  enums: [],
  functions: [],
};

/**
 * Load the project's schema IR.
 *
 * Resolution order:
 *  1. `config.schemaPath` (a TypeScript file using the `schema({...})` DSL).
 *  2. SQL files in `config.migrationsDir`, then `supabase/migrations`.
 *
 * Returns `null` when no schema source can be found.
 */
export async function loadSchemaIR(
  root: string,
  config: FakebaseConfig,
): Promise<ProjectSchemaIR | null> {
  const { parseTypescriptSchema, parseSqlSchema } =
    await import("@byronwade/migrations");

  // 1. TypeScript DSL schema.
  const schemaPath = resolve(root, config.schemaPath ?? "fakebase/schema.ts");
  if (existsSync(schemaPath)) {
    try {
      const text = await readFile(schemaPath, "utf8");
      return parseTypescriptSchema(text);
    } catch {
      // Fall through to SQL discovery.
    }
  }

  // 2. SQL migration files.
  const sqlDirs = [
    resolve(root, config.migrationsDir ?? "fakebase/migrations"),
    resolve(root, "supabase/migrations"),
  ];
  for (const dir of sqlDirs) {
    if (!existsSync(dir)) continue;
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    if (files.length === 0) continue;
    const combined = (
      await Promise.all(files.map((f) => readFile(join(dir, f), "utf8")))
    ).join("\n");
    const parsed = parseSqlSchema(combined);
    return {
      version: 1,
      tables: parsed.tables ?? [],
      enums: parsed.enums ?? [],
      functions: parsed.functions ?? [],
    };
  }

  return null;
}

/** Like {@link loadSchemaIR} but returns an empty schema instead of null. */
export async function loadSchemaIROrEmpty(
  root: string,
  config: FakebaseConfig,
): Promise<ProjectSchemaIR> {
  return (await loadSchemaIR(root, config)) ?? EMPTY_SCHEMA;
}

/**
 * Build a fully-wired kernel for the configured adapter.
 *
 * Falls back to the in-memory adapter when the configured adapter cannot be
 * loaded (e.g. native SQLite bindings unavailable), printing nothing — callers
 * decide how to surface the fallback.
 */
export async function buildKernel(
  root: string,
  config: FakebaseConfig,
  schema: ProjectSchemaIR,
): Promise<FakebaseKernel> {
  const adapter = config.adapter ?? "json";

  if (adapter === "memory") {
    const { createMemoryKernel } = await import("@byronwade/adapter-memory");
    return createMemoryKernel(schema);
  }

  if (adapter === "sqlite") {
    try {
      const mod = (await import("@byronwade/adapter-sqlite")) as {
        createSqliteKernel: (opts: {
          dbPath?: string;
          schema?: ProjectSchemaIR;
        }) => FakebaseKernel;
      };
      const dir =
        typeof config.adapterOptions?.["dir"] === "string"
          ? config.adapterOptions["dir"]
          : ".fakebase";
      return mod.createSqliteKernel({
        dbPath: resolve(root, dir, "fakebase.db"),
        schema,
      });
    } catch {
      const { createMemoryKernel } = await import("@byronwade/adapter-memory");
      return createMemoryKernel(schema);
    }
  }

  if (adapter === "pglite") {
    try {
      const mod = (await import("@byronwade/adapter-pglite")) as {
        createPGliteKernel: (opts: {
          dataDir?: string;
          schema?: ProjectSchemaIR;
        }) => FakebaseKernel;
      };
      const dir =
        typeof config.adapterOptions?.["dir"] === "string"
          ? config.adapterOptions["dir"]
          : ".fakebase";
      return mod.createPGliteKernel({
        dataDir: resolve(root, dir, "pglite"),
        schema,
      });
    } catch {
      const { createMemoryKernel } = await import("@byronwade/adapter-memory");
      return createMemoryKernel(schema);
    }
  }

  // Default: JSON adapter.
  const { createJsonKernel } = await import("@byronwade/adapter-json");
  const dir =
    typeof config.adapterOptions?.["dir"] === "string"
      ? config.adapterOptions["dir"]
      : ".fakebase";
  return createJsonKernel({ dir: resolve(root, dir), schema });
}
