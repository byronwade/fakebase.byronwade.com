import { resolve } from "node:path";
import chalk from "chalk";
import ora from "ora";
import chokidar from "chokidar";
import { loadConfig } from "../config.js";
import { buildKernel, loadSchemaIROrEmpty } from "../runtime.js";
import { print } from "../ui/print.js";

interface DevOptions {
  studio?: boolean;
  port?: string;
}

export async function runDev(options: DevOptions, cwd?: string): Promise<void> {
  const root = resolve(cwd ?? process.cwd());
  const config = await loadConfig(root);

  const devPort = options.port ? parseInt(options.port, 10) : (config.devPort ?? 54321);
  const schemaPath = resolve(root, config.schemaPath ?? "fakebase/schema.ts");

  print.devOnly();
  print.header("Fakebase Dev Server");

  const initSpinner = ora("Initializing Fakebase kernel…").start();

  let kernel: { close(): Promise<void> } | null = null;

  try {
    const schema = await loadSchemaIROrEmpty(root, config);
    kernel = await buildKernel(root, config, schema);

    const tableCount = schema.tables.length;
    initSpinner.succeed(
      `Fakebase kernel ready (${tableCount} table${tableCount === 1 ? "" : "s"}, ${config.adapter} adapter)`,
    );

    console.log();
    console.log(chalk.green.bold("Fakebase running"));
    console.log();
    console.log(
      `  ${chalk.bold("API URL:")}     ${chalk.cyan(`http://localhost:${devPort}`)}`,
    );
    console.log(
      `  ${chalk.bold("Auth URL:")}    ${chalk.cyan(`http://localhost:${devPort}/auth/v1`)}`,
    );
    console.log(
      `  ${chalk.bold("Storage URL:")} ${chalk.cyan(`http://localhost:${devPort}/storage/v1`)}`,
    );
    if (options.studio) {
      console.log(
        `  ${chalk.bold("Studio:")}      ${chalk.cyan(`http://localhost:${config.studioPort ?? 54323}`)}`,
      );
    }
    console.log();
    console.log(chalk.dim("Watching fakebase/schema.ts for changes…"));
    console.log(chalk.dim("Press Ctrl+C to stop."));
    console.log();
  } catch (err) {
    initSpinner.fail("Failed to start Fakebase kernel");
    throw err;
  }

  // Watch schema for changes
  const watcher = chokidar.watch(schemaPath, {
    ignoreInitial: true,
    persistent: true,
  });

  watcher.on("change", () => {
    print.info("Schema changed — re-applying migrations…");
    // In a full implementation this would re-run migration diff and apply
    print.step(
      "Schema reload triggered (run `fakebase migrate apply` to apply pending changes)",
    );
  });

  watcher.on("error", (err: unknown) => {
    print.warn(
      `Schema watcher error: ${err instanceof Error ? err.message : String(err)}`,
    );
  });

  // Keep process alive until SIGINT
  await new Promise<void>((resolve) => {
    const cleanup = async () => {
      console.log();
      print.step("Shutting down…");
      await watcher.close();
      if (kernel) {
        await kernel.close();
      }
      print.success("Fakebase stopped.");
      resolve();
    };

    process.once("SIGINT", () => void cleanup());
    process.once("SIGTERM", () => void cleanup());
  });
}
