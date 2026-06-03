import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import ora from "ora";
import chalk from "chalk";
import type { ProjectSchemaIR } from "@fakebase/core";
import { loadConfig, type FakebaseConfig } from "../config.js";
import { loadSchemaIROrEmpty } from "../runtime.js";
import { print } from "../ui/print.js";
import { renderTable } from "../ui/table.js";

const EMPTY_SCHEMA: ProjectSchemaIR = {
  version: 0,
  tables: [],
  enums: [],
  functions: [],
};

async function migrationsDirFor(root: string, config: FakebaseConfig): Promise<string> {
  return resolve(root, config.migrationsDir ?? "fakebase/migrations");
}

async function listMigrationFiles(migrationsDir: string): Promise<string[]> {
  if (!existsSync(migrationsDir)) return [];
  const entries = await readdir(migrationsDir);
  return entries.filter((f) => f.endsWith(".sql")).sort();
}

/** Parse the already-migrated state from the SQL files in `migrationsDir`. */
async function schemaFromMigrations(migrationsDir: string): Promise<ProjectSchemaIR> {
  const files = await listMigrationFiles(migrationsDir);
  if (files.length === 0) return EMPTY_SCHEMA;
  const { parseSqlSchema } = await import("@fakebase/migrations");
  const combined = (
    await Promise.all(files.map((f) => readFile(join(migrationsDir, f), "utf8")))
  ).join("\n");
  const parsed = parseSqlSchema(combined);
  return {
    version: 1,
    tables: parsed.tables ?? [],
    enums: parsed.enums ?? [],
    functions: parsed.functions ?? [],
  };
}

/** Load the desired schema authored in `fakebase/schema.ts`. */
async function loadDesiredSchema(
  root: string,
  config: FakebaseConfig,
): Promise<ProjectSchemaIR | null> {
  const schemaPath = resolve(root, config.schemaPath ?? "fakebase/schema.ts");
  if (!existsSync(schemaPath)) return null;
  const { parseTypescriptSchema } = await import("@fakebase/migrations");
  const text = await readFile(schemaPath, "utf8");
  return parseTypescriptSchema(text);
}

/** Compute the pending SQL between applied migrations and the authored schema. */
async function computePendingSql(
  root: string,
  config: FakebaseConfig,
): Promise<{ sql: string; empty: boolean } | null> {
  const desired = await loadDesiredSchema(root, config);
  if (!desired) return null;

  const migrationsDir = await migrationsDirFor(root, config);
  const previous = await schemaFromMigrations(migrationsDir);

  const { diffSchemas, diffToSql, isSchemaDiffEmpty } =
    await import("@fakebase/migrations");
  const diff = diffSchemas(previous, desired);
  return { sql: diffToSql(diff), empty: isSchemaDiffEmpty(diff) };
}

export async function runMigrateNew(name: string, cwd?: string): Promise<void> {
  const root = resolve(cwd ?? process.cwd());
  const config = await loadConfig(root);
  const migrationsDir = await migrationsDirFor(root, config);

  const spinner = ora(`Creating migration "${name}"…`).start();

  const pending = await computePendingSql(root, config);
  const { MigrationManager } = await import("@fakebase/migrations");
  const manager = new MigrationManager(migrationsDir);

  if (pending === null) {
    spinner.warn("No fakebase/schema.ts found — creating an empty migration");
    const record = await manager.create(name);
    print.success(`Migration created: ${config.migrationsDir}/${record.fileName}`);
    print.step("Add your SQL to the generated file.");
    return;
  }

  if (pending.empty) {
    spinner.info("No schema changes detected — nothing to migrate.");
    return;
  }

  const record = await manager.create(name, pending.sql);
  spinner.succeed("Diff computed");
  print.success(`Migration created: ${config.migrationsDir}/${record.fileName}`);
}

export async function runMigrateDiff(cwd?: string): Promise<void> {
  const root = resolve(cwd ?? process.cwd());
  const config = await loadConfig(root);

  const spinner = ora("Computing schema diff…").start();
  const pending = await computePendingSql(root, config);

  if (pending === null) {
    spinner.warn("No fakebase/schema.ts found.");
    print.step("Author your schema with the `schema({...})` DSL to enable diffs.");
    return;
  }

  if (pending.empty) {
    spinner.succeed("Schema is up to date — no pending changes.");
    return;
  }

  spinner.succeed("Diff computed");
  console.log();
  console.log(chalk.bold("Pending SQL:"));
  console.log();
  console.log(chalk.cyan(pending.sql));
  console.log();
}

export async function runMigrateExport(
  opts: { supabase?: boolean },
  cwd?: string,
): Promise<void> {
  const root = resolve(cwd ?? process.cwd());
  const config = await loadConfig(root);
  const migrationsDir = await migrationsDirFor(root, config);

  const files = await listMigrationFiles(migrationsDir);
  if (files.length === 0) {
    print.warn(`No migration files found in ${config.migrationsDir}/`);
    return;
  }

  if (!opts.supabase) {
    print.warn("Specify an export target. Available: --supabase");
    return;
  }

  const supabaseMigrationsDir = join(root, "supabase", "migrations");
  await mkdir(supabaseMigrationsDir, { recursive: true });

  const spinner = ora(
    `Exporting ${files.length} migration(s) to supabase/migrations/…`,
  ).start();

  for (const file of files) {
    const content = await readFile(join(migrationsDir, file), "utf8");
    await writeFile(join(supabaseMigrationsDir, file), content, "utf8");
  }

  spinner.succeed(`Exported ${files.length} migration(s) to supabase/migrations/`);
}

export async function runMigrateApply(cwd?: string): Promise<void> {
  const root = resolve(cwd ?? process.cwd());
  const config = await loadConfig(root);
  const migrationsDir = await migrationsDirFor(root, config);

  const { MigrationManager } = await import("@fakebase/migrations");
  const manager = new MigrationManager(migrationsDir);
  const pending = await manager.pending();

  if (pending.length === 0) {
    print.info("No pending migrations to apply.");
    return;
  }

  const spinner = ora(`Applying ${pending.length} migration(s)…`).start();

  try {
    // Local "apply" = (re)initialize the configured adapter with the current
    // schema, then record each migration in the applied ledger. The adapters
    // are schema-IR driven (not arbitrary-SQL executors), so this syncs the
    // local adapter's schema rather than replaying raw DDL.
    const schema = await loadSchemaIROrEmpty(root, config);
    const { buildKernel } = await import("../runtime.js");
    const kernel = await buildKernel(root, config, schema);
    await kernel.close();

    for (const migration of pending) {
      await manager.markApplied(migration.version);
    }

    spinner.succeed(`Applied ${pending.length} migration(s)`);
    for (const migration of pending) {
      print.step(migration.fileName);
    }
  } catch (err) {
    spinner.fail("Failed to apply migrations");
    throw err;
  }
}

export async function runMigrateStatus(cwd?: string): Promise<void> {
  const root = resolve(cwd ?? process.cwd());
  const config = await loadConfig(root);
  const migrationsDir = await migrationsDirFor(root, config);

  const { MigrationManager } = await import("@fakebase/migrations");
  const manager = new MigrationManager(migrationsDir);
  const migrations = await manager.list();

  if (migrations.length === 0) {
    print.info("No migrations found.");
    return;
  }

  const rows = migrations.map((m) => [
    basename(m.fileName),
    m.appliedAt ? chalk.green("✓ applied") : chalk.yellow("⟳ pending"),
  ]);

  console.log();
  console.log(renderTable(["Migration", "Status"], rows));
  console.log();
}
