import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import ora from "ora";
import { loadConfig } from "../config.js";
import { buildKernel, loadSchemaIROrEmpty } from "../runtime.js";
import { print } from "../ui/print.js";

export async function runSeedRun(cwd?: string): Promise<void> {
  const root = resolve(cwd ?? process.cwd());
  const config = await loadConfig(root);
  const seedPath = resolve(root, config.seedPath ?? "fakebase/seeds/seed.ts");

  const spinner = ora("Running seeds…").start();

  try {
    // Load the seed module dynamically. Note: running a `.ts` seed file
    // directly requires a TypeScript loader (e.g. `tsx`); plain Node can only
    // import compiled `.js`/`.mjs`.
    let seedFn: ((client: unknown) => Promise<void>) | undefined;
    try {
      const seedMod = (await import(seedPath)) as {
        default?: (client: unknown) => Promise<void>;
      };
      seedFn = seedMod.default;
    } catch (err) {
      spinner.fail(`Failed to load seed file: ${seedPath}`);
      print.warn(
        "Make sure the seed file exists (run `fakebase init`) and is runnable — for a `.ts` seed, run the CLI via `tsx`.",
      );
      throw err;
    }

    if (typeof seedFn !== "function") {
      spinner.fail("Seed file must export a default function");
      throw new Error("seed file must export a default async function");
    }

    const schema = await loadSchemaIROrEmpty(root, config);
    const kernel = await buildKernel(root, config, schema);

    const { createClient } = await import("@fakebase/client");
    const client = createClient("http://localhost", "service_role", { kernel });

    try {
      await seedFn(client);
      spinner.succeed("Seeds applied");
      print.success("Seed data inserted");
    } finally {
      await kernel.close();
    }
  } catch (err) {
    spinner.fail("Seeding failed");
    throw err;
  }
}

/** Options accepted by `fakebase seed gen`. */
export interface SeedGenOptions {
  rows?: number;
  seed?: number;
  /** Per-table count overrides expressed as `name:count` strings. */
  table?: string[];
  /** Output path for the generated SQL. Default `supabase/seed.sql`. */
  out?: string;
  /** Print the per-column resolution report instead of staying silent. */
  report?: boolean;
  /** Use the optional `@fakebase/seed-faker` provider for richer data. */
  faker?: boolean;
  cwd?: string;
}

function parseTableCounts(entries: string[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const entry of entries ?? []) {
    const idx = entry.lastIndexOf(":");
    if (idx === -1) {
      throw new Error(`Invalid --table value "${entry}". Use name:count.`);
    }
    const name = entry.slice(0, idx);
    const count = Number(entry.slice(idx + 1));
    if (!name || !Number.isInteger(count) || count < 0) {
      throw new Error(`Invalid --table value "${entry}". Use name:count.`);
    }
    out[name] = count;
  }
  return out;
}

/**
 * Generate referentially-correct fake data straight from the schema and write
 * it to `supabase/seed.sql`. Deterministic; uses the built-in data provider
 * unless `--faker` is passed (and `@fakebase/seed-faker` is installed).
 */
export async function runSeedGen(options: SeedGenOptions = {}): Promise<void> {
  const root = resolve(options.cwd ?? process.cwd());
  const config = await loadConfig(root);
  const schema = await loadSchemaIROrEmpty(root, config);

  if (schema.tables.length === 0) {
    print.warn(
      "No tables found in your schema. Define a schema (see `fakebase init`) before generating data.",
    );
    return;
  }

  const cfg = config.seedGen ?? {};
  const generateOptions = {
    rowsPerTable: options.rows ?? cfg.rowsPerTable ?? 10,
    seed: options.seed ?? cfg.seed ?? 0,
    nullRate: cfg.nullRate ?? 0,
    tables: { ...cfg.tables, ...parseTableCounts(options.table) },
  };

  const { generateRows, describeResolution } = await import("@fakebase/seed");

  // Optional Faker provider — honest failure if it isn't installed.
  let provider: import("@fakebase/seed").DataProvider | undefined;
  if (options.faker) {
    try {
      const { loadFakerProvider } = await import("@fakebase/seed-faker");
      provider = await loadFakerProvider();
    } catch {
      print.error(
        "--faker requires the optional `@faker-js/faker` package. Install it with `pnpm add -D @faker-js/faker`.",
      );
      throw new Error("@faker-js/faker not installed");
    }
  }

  if (options.report) {
    print.header("Column resolution");
    for (const r of describeResolution(schema, { provider })) {
      const label = r.detail ? `${r.strategy} (${r.detail})` : r.strategy;
      print.step(`${r.table}.${r.column} → ${label}`);
    }
    console.log();
  }

  const spinner = ora("Generating fake data…").start();
  try {
    // Generate deterministically and export directly. Defaulted/generated
    // columns are intentionally omitted so the database fills them on load —
    // this keeps the output deterministic (no `now()` timestamps baked in).
    const generated = generateRows(schema, { ...generateOptions, provider });

    const rows: Record<string, Record<string, unknown>[]> = {};
    for (const [key, value] of Object.entries(generated)) {
      const tableName = key.includes(".") ? key.slice(key.indexOf(".") + 1) : key;
      rows[tableName] = value;
    }

    const { exportSeedSql } = await import("@fakebase/migrations");
    // Omit the timestamp header so re-running with the same seed yields a
    // byte-identical file (clean git diffs).
    const seedSql = exportSeedSql(schema, rows, { timestamp: false });

    const outPath = resolve(root, options.out ?? "supabase/seed.sql");
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, seedSql, "utf8");

    const total = Object.values(rows).reduce((a, r) => a + r.length, 0);
    spinner.succeed(
      `Generated ${total} rows across ${Object.keys(rows).length} tables`,
    );
    print.success(`Wrote ${options.out ?? "supabase/seed.sql"}`);
  } catch (err) {
    spinner.fail("Fake data generation failed");
    throw err;
  }
}

export async function runSeedExport(cwd?: string): Promise<void> {
  const root = resolve(cwd ?? process.cwd());
  const config = await loadConfig(root);

  const spinner = ora("Exporting seed data to supabase/seed.sql…").start();

  try {
    const schema = await loadSchemaIROrEmpty(root, config);
    const kernel = await buildKernel(root, config, schema);

    // `snapshot()` keys are `"<schema>.<table>"` — exportSeedSql expects plain
    // table names, so strip the schema prefix.
    const snapshot = kernel.snapshot();
    await kernel.close();

    const rows: Record<string, Record<string, unknown>[]> = {};
    for (const [key, value] of Object.entries(snapshot)) {
      const tableName = key.includes(".") ? key.slice(key.indexOf(".") + 1) : key;
      rows[tableName] = value as Record<string, unknown>[];
    }

    const { exportSeedSql } = await import("@fakebase/migrations");
    const seedSql = exportSeedSql(schema, rows);

    const supabaseDir = join(root, "supabase");
    await mkdir(supabaseDir, { recursive: true });
    const outputPath = join(supabaseDir, "seed.sql");
    await writeFile(outputPath, seedSql, "utf8");

    spinner.succeed("Exported to supabase/seed.sql");
    print.success(
      existsSync(outputPath) ? "supabase/seed.sql written" : "seed export complete",
    );
  } catch (err) {
    spinner.fail("Seed export failed");
    throw err;
  }
}
