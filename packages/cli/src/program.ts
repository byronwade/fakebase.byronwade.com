import { Command } from "commander";
import { runInit } from "./commands/init.js";
import { runDev } from "./commands/dev.js";
import { runServe } from "./commands/serve.js";
import { runStudio } from "./commands/studio.js";
import {
  runMigrateNew,
  runMigrateDiff,
  runMigrateExport,
  runMigrateApply,
  runMigrateStatus,
} from "./commands/migrate.js";
import { runTypesGen } from "./commands/types.js";
import { runSeedRun, runSeedExport, runSeedGen } from "./commands/seed.js";
import { runAuthInbox, runAuthUsers } from "./commands/auth.js";
import {
  runSnapshotSave,
  runSnapshotRestore,
  runSnapshotList,
} from "./commands/snapshot.js";
import { runVerifySupabase } from "./commands/verify.js";
import { runDoctor } from "./commands/doctor.js";
import { runAiInit, runAiPrompt } from "./commands/ai.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("fakebase")
    .description(
      "Fakebase CLI — local Supabase-shaped dev platform for Next.js prototypes",
    )
    .version("0.1.0");

  // ─── fakebase init ───────────────────────────────────────────────────────────
  program
    .command("init")
    .description(
      "Initialize Fakebase in the current project. Creates fakebase/ directory structure and lib/fakebase.ts for Next.js apps.",
    )
    .action(async () => {
      await runInit();
    });

  // ─── fakebase dev ────────────────────────────────────────────────────────────
  program
    .command("dev")
    .description("Start the Fakebase local development server.")
    .option("--studio", "Also start the admin UI server")
    .option("--port <port>", "Port for the dev server (default: 54321)")
    .action(async (opts: { studio?: boolean; port?: string }) => {
      await runDev(opts);
    });

  // ─── fakebase serve ──────────────────────────────────────────────────────────
  program
    .command("serve")
    .description(
      "Serve a Supabase-wire-compatible HTTP API so the real @supabase/supabase-js can connect.",
    )
    .option("--port <port>", "Port for the HTTP server (default: 54321)")
    .action(async (opts: { port?: string }) => {
      await runServe(opts);
    });

  // ─── fakebase studio ─────────────────────────────────────────────────────────
  program
    .command("studio")
    .description("Open the Fakebase admin UI in the browser.")
    .action(async () => {
      await runStudio();
    });

  // ─── fakebase migrate ────────────────────────────────────────────────────────
  const migrate = program.command("migrate").description("Manage database migrations.");

  migrate
    .command("new <name>")
    .description(
      "Create a new migration file. Computes diff from the last migration and writes SQL to fakebase/migrations/<timestamp>_<name>.sql.",
    )
    .action(async (name: string) => {
      await runMigrateNew(name);
    });

  migrate
    .command("diff")
    .description(
      "Print the SQL diff between the current schema and the last applied migration.",
    )
    .action(async () => {
      await runMigrateDiff();
    });

  migrate
    .command("export")
    .description("Export pending local migrations to a target directory.")
    .option(
      "--supabase",
      "Write to supabase/migrations/ (creates directory if missing)",
    )
    .action(async (opts: { supabase?: boolean }) => {
      await runMigrateExport(opts);
    });

  migrate
    .command("apply")
    .description("Apply pending migrations to the local adapter.")
    .action(async () => {
      await runMigrateApply();
    });

  migrate
    .command("status")
    .description("Show migrations and their applied status.")
    .action(async () => {
      await runMigrateStatus();
    });

  // ─── fakebase types ──────────────────────────────────────────────────────────
  const types = program
    .command("types")
    .description("Manage TypeScript types generated from the schema.");

  types
    .command("gen")
    .description("Generate database.types.ts from fakebase/schema.ts.")
    .action(async () => {
      await runTypesGen();
    });

  // ─── fakebase seed ───────────────────────────────────────────────────────────
  const seed = program.command("seed").description("Manage seed data.");

  seed
    .command("run")
    .description("Load and run fakebase/seeds/seed.ts against the local adapter.")
    .action(async () => {
      await runSeedRun();
    });

  seed
    .command("export")
    .description("Export current seed data to supabase/seed.sql.")
    .action(async () => {
      await runSeedExport();
    });

  seed
    .command("gen")
    .description("Generate referentially-correct fake data from your schema.")
    .option("--rows <n>", "rows per table", (v) => parseInt(v, 10))
    .option("--seed <n>", "RNG seed for deterministic output", (v) => parseInt(v, 10))
    .option(
      "--table <name:count...>",
      "per-table row count override (repeatable)",
    )
    .option("--out <path>", "output path (default supabase/seed.sql)")
    .option("--report", "print how each column resolves")
    .option("--faker", "use the optional @byronwade/seed-faker provider")
    .action(async (opts) => {
      await runSeedGen({
        rows: opts.rows,
        seed: opts.seed,
        table: opts.table,
        out: opts.out,
        report: opts.report,
        faker: opts.faker,
      });
    });

  // ─── fakebase auth ───────────────────────────────────────────────────────────
  const auth = program.command("auth").description("Inspect the local auth service.");

  auth
    .command("inbox")
    .description("Print the local OTP / magic-link inbox as a formatted table.")
    .action(async () => {
      await runAuthInbox();
    });

  auth
    .command("users")
    .description("List all local auth users.")
    .action(async () => {
      await runAuthUsers();
    });

  // ─── fakebase snapshot ───────────────────────────────────────────────────────
  const snapshot = program
    .command("snapshot")
    .description("Save and restore named snapshots of the local adapter state.");

  snapshot
    .command("save [label]")
    .description(
      "Save the current adapter state as a named snapshot. Defaults to a timestamp label.",
    )
    .action(async (label?: string) => {
      await runSnapshotSave(label);
    });

  snapshot
    .command("restore <label>")
    .description("Restore a previously saved snapshot by label.")
    .action(async (label: string) => {
      await runSnapshotRestore(label);
    });

  snapshot
    .command("list")
    .description("List all saved snapshots.")
    .action(async () => {
      await runSnapshotList();
    });

  // ─── fakebase verify ─────────────────────────────────────────────────────────
  const verify = program
    .command("verify")
    .description("Verify Fakebase compatibility against real services.");

  verify
    .command("supabase")
    .description(
      "Run compatibility scenarios against both Fakebase and real Supabase. Requires SUPABASE_URL and SUPABASE_ANON_KEY.",
    )
    .action(async () => {
      await runVerifySupabase();
    });

  // ─── fakebase doctor ─────────────────────────────────────────────────────────
  program
    .command("doctor")
    .description(
      "Run a health check on the Fakebase setup. Checks schema, types, migrations, adapter, and app code.",
    )
    .action(async () => {
      await runDoctor();
    });

  // ─── fakebase ai ─────────────────────────────────────────────────────────────
  const ai = program
    .command("ai")
    .description("Generate AI agent rule files and prompts.");

  ai.command("init")
    .description(
      "Generate AI rule files: .cursor/rules/fakebase.mdc, AGENTS.md, fakebase.rules.md, and docs/ summaries.",
    )
    .action(async () => {
      await runAiInit();
    });

  ai.command("prompt")
    .description(
      "Generate a task-specific prompt for an AI agent working on this project.",
    )
    .option(
      "--target <target>",
      "Target AI tool: cursor | claude | copilot | generic (default: generic)",
      "generic",
    )
    .option("--output <file>", "Write prompt to a file instead of stdout")
    .action(async (opts: { target?: string; output?: string }) => {
      await runAiPrompt(opts);
    });

  return program;
}
