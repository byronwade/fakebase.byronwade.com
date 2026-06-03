import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import chalk from "chalk";
import { print } from "../ui/print.js";
import { loadConfig } from "../config.js";

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function hashFile(p: string): Promise<string> {
  const content = await readFile(p, "utf8");
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

interface CheckResult {
  label: string;
  status: "pass" | "fail" | "warn";
  detail?: string;
}

function renderCheck(result: CheckResult): string {
  const icon =
    result.status === "pass"
      ? chalk.green("✅")
      : result.status === "fail"
        ? chalk.red("❌")
        : chalk.yellow("⚠️ ");

  const msg =
    result.status === "pass"
      ? chalk.green(result.label)
      : result.status === "fail"
        ? chalk.red(result.label)
        : chalk.yellow(result.label);

  const detail = result.detail ? `\n     ${chalk.dim(result.detail)}` : "";

  return `  ${icon}  ${msg}${detail}`;
}

export async function runDoctor(cwd?: string): Promise<void> {
  const root = resolve(cwd ?? process.cwd());
  const config = await loadConfig(root);

  print.header("Fakebase Doctor");
  console.log();

  const checks: CheckResult[] = [];
  let hasCriticalFailure = false;

  // 1. Schema present
  const schemaPath = resolve(root, config.schemaPath ?? "fakebase/schema.ts");
  if (await fileExists(schemaPath)) {
    checks.push({ label: "fakebase/schema.ts is present", status: "pass" });
  } else {
    checks.push({
      label: "fakebase/schema.ts is missing",
      status: "fail",
      detail: "Run `fakebase init` to create it.",
    });
    hasCriticalFailure = true;
  }

  // 2. database.types.ts up to date
  const typesPath = resolve(root, "database.types.ts");
  if (await fileExists(typesPath)) {
    if (await fileExists(schemaPath)) {
      const schemaHash = await hashFile(schemaPath);
      const typesContent = await readFile(typesPath, "utf8");
      const hasSchemaHash = typesContent.includes(schemaHash);
      if (hasSchemaHash) {
        checks.push({
          label: "database.types.ts is up to date",
          status: "pass",
        });
      } else {
        checks.push({
          label: "database.types.ts may be stale",
          status: "warn",
          detail: "Run `fakebase types gen` to regenerate.",
        });
      }
    } else {
      checks.push({
        label: "database.types.ts present (schema missing, cannot verify freshness)",
        status: "warn",
      });
    }
  } else {
    checks.push({
      label: "database.types.ts not generated",
      status: "warn",
      detail: "Run `fakebase types gen`.",
    });
  }

  // 3. Pending migrations not exported to Supabase
  const migrationsDir = resolve(root, config.migrationsDir ?? "fakebase/migrations");
  const supabaseMigrationsDir = join(root, "supabase", "migrations");
  if (await fileExists(migrationsDir)) {
    const { readdir } = await import("node:fs/promises");
    const localFiles = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql"));
    if (localFiles.length > 0) {
      if (await fileExists(supabaseMigrationsDir)) {
        const supabaseFiles = (await readdir(supabaseMigrationsDir)).filter((f) =>
          f.endsWith(".sql"),
        );
        const supabaseSet = new Set(supabaseFiles);
        const pending = localFiles.filter((f) => !supabaseSet.has(f));
        if (pending.length === 0) {
          checks.push({
            label: "All migrations exported to supabase/migrations/",
            status: "pass",
          });
        } else {
          checks.push({
            label: `${pending.length} migration(s) not exported to Supabase`,
            status: "warn",
            detail: "Run `fakebase migrate export --supabase`.",
          });
        }
      } else {
        checks.push({
          label: "Migrations not exported to supabase/migrations/",
          status: "warn",
          detail: "Run `fakebase migrate export --supabase`.",
        });
      }
    } else {
      checks.push({
        label: "No local migrations found",
        status: "pass",
      });
    }
  } else {
    checks.push({
      label: "Migrations directory not found",
      status: "warn",
      detail: "Run `fakebase init` to set up the project.",
    });
  }

  // 4. Adapter configured
  if (config.adapter) {
    checks.push({
      label: `Adapter configured: ${config.adapter}`,
      status: "pass",
    });
  } else {
    checks.push({
      label: "No adapter configured",
      status: "fail",
      detail: "Add an adapter to fakebase.config.json.",
    });
    hasCriticalFailure = true;
  }

  // 5. .fakebase directory exists (adapter data)
  const adapterDir = resolve(
    root,
    typeof config.adapterOptions?.["dir"] === "string"
      ? config.adapterOptions["dir"]
      : ".fakebase",
  );
  if (await fileExists(adapterDir)) {
    checks.push({ label: ".fakebase/ local data directory exists", status: "pass" });
  } else {
    checks.push({
      label: ".fakebase/ local data directory missing",
      status: "warn",
      detail: "It will be created when you run `fakebase dev`.",
    });
  }

  // 6. Scan for @byronwade/core imports in app code (capability stubs)
  const stubPatterns = ["kernel.functions.callRpc", "StubStorage", "StubAuth"];
  const appDirs = ["app", "pages", "src", "components", "lib"];
  const foundStubs: string[] = [];

  for (const dir of appDirs) {
    const dirPath = join(root, dir);
    if (!(await fileExists(dirPath))) continue;
    try {
      const walk = async (d: string): Promise<void> => {
        const { readdir } = await import("node:fs/promises");
        const entries = await readdir(d, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            await walk(join(d, entry.name));
          } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
            const content = await readFile(join(d, entry.name), "utf8");
            for (const pattern of stubPatterns) {
              if (content.includes(pattern)) {
                foundStubs.push(`${join(d, entry.name)}: ${pattern}`);
              }
            }
          }
        }
      };
      await walk(dirPath);
    } catch {
      // ignore scan errors
    }
  }

  if (foundStubs.length === 0) {
    checks.push({
      label: "No capability stub calls found in app code",
      status: "pass",
    });
  } else {
    checks.push({
      label: `${foundStubs.length} capability stub call(s) found in app code`,
      status: "warn",
      detail: foundStubs.slice(0, 3).join("; ") + (foundStubs.length > 3 ? "…" : ""),
    });
  }

  // Render results
  for (const check of checks) {
    console.log(renderCheck(check));
  }

  console.log();

  const failures = checks.filter((c) => c.status === "fail").length;
  const warnings = checks.filter((c) => c.status === "warn").length;
  const passes = checks.filter((c) => c.status === "pass").length;

  console.log(
    chalk.dim(
      `Results: ${chalk.green(String(passes))} passed, ${chalk.yellow(String(warnings))} warned, ${chalk.red(String(failures))} failed`,
    ),
  );
  console.log();

  if (hasCriticalFailure) {
    print.error("Critical issues found. See above.");
    process.exit(1);
  } else if (failures > 0) {
    print.error(`${failures} check(s) failed.`);
    process.exit(1);
  } else if (warnings > 0) {
    print.warn(`${warnings} warning(s). Run the suggested commands above.`);
  } else {
    print.success("All checks passed!");
  }
}
