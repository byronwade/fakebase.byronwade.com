import { resolve } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { loadConfig } from "../config.js";
import { buildKernel, loadSchemaIROrEmpty } from "../runtime.js";
import { print } from "../ui/print.js";

interface ServeOptions {
  port?: string;
  cwd?: string;
}

/**
 * Start a local HTTP server that speaks the Supabase wire protocol, backed by
 * the kernel. The real `@supabase/supabase-js` (browser or server) can then
 * point at it as a drop-in.
 */
export async function runServe(options: ServeOptions = {}): Promise<void> {
  const root = resolve(options.cwd ?? process.cwd());
  const config = await loadConfig(root);
  const port = options.port ? parseInt(options.port, 10) : (config.devPort ?? 54321);

  print.devOnly();
  const spinner = ora("Starting Fakebase server…").start();

  const schema = await loadSchemaIROrEmpty(root, config);
  const kernel = await buildKernel(root, config, schema);

  const { createFakebaseServer } = await import("@byronwade/server");
  const server = createFakebaseServer({ kernel });
  const { url } = await server.listen(port);

  spinner.succeed(
    `Fakebase server ready (${schema.tables.length} table${schema.tables.length === 1 ? "" : "s"}, ${config.adapter} adapter)`,
  );
  console.log();
  console.log(`  ${chalk.bold("API URL")}    ${chalk.cyan(url)}`);
  console.log(`  ${chalk.bold("anon key")}   ${chalk.dim(server.anonKey)}`);
  console.log(`  ${chalk.bold("service")}    ${chalk.dim(server.serviceKey)}`);
  console.log();
  console.log(chalk.dim("  Point the real @supabase/supabase-js at it:"));
  console.log(chalk.dim(`    import { createClient } from "@supabase/supabase-js";`));
  console.log(chalk.dim(`    const supabase = createClient("${url}", "${server.anonKey}");`));
  console.log();
  console.log(chalk.dim("  Press Ctrl+C to stop."));

  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      console.log();
      void server.listen; // keep ref
      resolve();
    });
  });
  await kernel.close();
  print.success("Server stopped");
}
