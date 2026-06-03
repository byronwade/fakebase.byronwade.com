import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { readTemplate, SEED_TEMPLATE, GITIGNORE_ENTRY } from "../templates/index.js";

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureGitignore(cwd: string): Promise<void> {
  const gitignorePath = join(cwd, ".gitignore");
  let content = "";
  if (await fileExists(gitignorePath)) {
    content = await readFile(gitignorePath, "utf8");
  }
  if (!content.includes(".fakebase/")) {
    await writeFile(gitignorePath, content + GITIGNORE_ENTRY, "utf8");
  }
}

function detectNextJs(cwd: string): Promise<boolean> {
  return Promise.all([
    fileExists(join(cwd, "app")),
    fileExists(join(cwd, "pages")),
    fileExists(join(cwd, "next.config.ts")),
    fileExists(join(cwd, "next.config.js")),
    fileExists(join(cwd, "next.config.mjs")),
  ]).then((results) => results.some(Boolean));
}

export async function runInit(cwd?: string): Promise<void> {
  const root = resolve(cwd ?? process.cwd());

  console.log();
  print_header("Fakebase Init");

  const spinner = ora("Creating fakebase/ directory structure…").start();

  try {
    // Create directories
    await mkdir(join(root, "fakebase", "seeds"), { recursive: true });
    await mkdir(join(root, "fakebase", "migrations"), { recursive: true });
    await mkdir(join(root, "fakebase", "storage"), { recursive: true });
    await mkdir(join(root, ".fakebase"), { recursive: true });

    // Write starter schema
    const schemaTemplate = await readTemplate("schema.ts.template");
    const schemaPath = join(root, "fakebase", "schema.ts");
    if (!(await fileExists(schemaPath))) {
      await writeFile(schemaPath, schemaTemplate, "utf8");
    }

    // Write starter seed
    const seedPath = join(root, "fakebase", "seeds", "seed.ts");
    if (!(await fileExists(seedPath))) {
      await writeFile(seedPath, SEED_TEMPLATE, "utf8");
    }

    spinner.succeed("Fakebase directory structure created");

    // .fakebase gitignore
    const gitSpinner = ora("Updating .gitignore…").start();
    await ensureGitignore(root);
    gitSpinner.succeed(".gitignore updated");

    // Detect Next.js and add lib/fakebase.ts
    const isNextJs = await detectNextJs(root);
    if (isNextJs) {
      const libSpinner = ora("Detected Next.js — adding lib/fakebase.ts…").start();
      await mkdir(join(root, "lib"), { recursive: true });
      const libPath = join(root, "lib", "fakebase.ts");
      if (!(await fileExists(libPath))) {
        const libTemplate = await readTemplate("lib-fakebase.ts.template");
        await writeFile(libPath, libTemplate, "utf8");
        libSpinner.succeed("lib/fakebase.ts created");
      } else {
        libSpinner.info("lib/fakebase.ts already exists — skipped");
      }
    }

    console.log();
    console.log(chalk.green.bold("✓ Fakebase initialized successfully!"));
    console.log();
    console.log(chalk.bold("Directory structure:"));
    console.log(chalk.dim("  fakebase/"));
    console.log(chalk.dim("    schema.ts          ← define your tables here"));
    console.log(chalk.dim("    seeds/seed.ts       ← seed data"));
    console.log(chalk.dim("    migrations/         ← auto-generated SQL migrations"));
    console.log(chalk.dim("    storage/            ← local file storage"));
    console.log(chalk.dim("  .fakebase/            ← local data (gitignored)"));
    if (isNextJs) {
      console.log(chalk.dim("  lib/fakebase.ts     ← import { fakebase } from here"));
    }
    console.log();
    console.log(chalk.bold("Next steps:"));
    console.log(
      `  ${chalk.cyan("fakebase dev")}         — start local Fakebase server`,
    );
    console.log(`  ${chalk.cyan("fakebase studio")}      — open the admin UI`);
    console.log(
      `  ${chalk.cyan("fakebase seed gen")}    — fill your schema with fake data → supabase/seed.sql`,
    );
    console.log(
      `  ${chalk.cyan("fakebase migrate new")} ${chalk.dim("<name>")} — create a migration`,
    );
    console.log();
  } catch (err) {
    spinner.fail("Init failed");
    throw err;
  }
}

function print_header(title: string): void {
  const border = "─".repeat(50);
  console.log(chalk.bold(border));
  console.log(chalk.bold(`  ${title}`));
  console.log(chalk.bold(border));
}
