import chalk from "chalk";
import ora from "ora";
import { print } from "../ui/print.js";
import { renderTable } from "../ui/table.js";
import type { CompatReport, SupabaseLikeClient } from "@byronwade/test-utils/compat";

function statusColor(status: CompatReport["status"]): string {
  switch (status) {
    case "EXACT":
      return chalk.green(status);
    case "CLOSE":
      return chalk.cyan(status);
    case "PARTIAL":
      return chalk.yellow(status);
    case "UNSUPPORTED":
    case "ERROR":
      return chalk.red(status);
    default:
      return status;
  }
}

/**
 * Dynamically import the real Supabase client without a static dependency.
 * Returns `null` when `@supabase/supabase-js` is not installed.
 */
async function tryLoadSupabaseClient(
  url: string,
  key: string,
): Promise<SupabaseLikeClient | null> {
  try {
    const specifier = "@supabase/supabase-js";
    const mod = (await import(specifier)) as {
      createClient: (u: string, k: string) => SupabaseLikeClient;
    };
    return mod.createClient(url, key);
  } catch {
    return null;
  }
}

export async function runVerifySupabase(): Promise<void> {
  print.devOnly();
  print.header("Fakebase ↔ Supabase Compatibility Check");

  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseAnonKey = process.env["SUPABASE_ANON_KEY"];

  const { DEFAULT_COMPAT_SCENARIOS, runCompatSuite } =
    await import("@byronwade/test-utils/compat");
  const { TEST_SCHEMA } = await import("@byronwade/test-utils/fixtures");
  const { createMemoryKernel } = await import("@byronwade/adapter-memory");
  const { createClient } = await import("@byronwade/client");

  const kernel = createMemoryKernel(TEST_SCHEMA);
  const fakebaseClient = createClient("http://localhost", "service_role", {
    kernel,
  }) as unknown as SupabaseLikeClient;

  let supabaseClient: SupabaseLikeClient | undefined;
  if (supabaseUrl && supabaseAnonKey) {
    print.info(`Comparing against live Supabase: ${supabaseUrl}`);
    const loaded = await tryLoadSupabaseClient(supabaseUrl, supabaseAnonKey);
    if (loaded) {
      supabaseClient = loaded;
    } else {
      print.warn(
        "@supabase/supabase-js is not installed — running Fakebase-only (results marked PARTIAL).",
      );
    }
  } else {
    print.warn(
      "SUPABASE_URL / SUPABASE_ANON_KEY not set — running Fakebase-only (results marked PARTIAL).",
    );
    console.log();
    print.step("To compare against a real Supabase stack:");
    console.log(chalk.cyan("   supabase start"));
    console.log(chalk.cyan('   export SUPABASE_URL="http://127.0.0.1:54321"'));
    console.log(chalk.cyan('   export SUPABASE_ANON_KEY="<local anon key>"'));
  }

  console.log();
  const spinner = ora(
    `Running ${DEFAULT_COMPAT_SCENARIOS.length} compatibility scenarios…`,
  ).start();

  const reports = await runCompatSuite(
    DEFAULT_COMPAT_SCENARIOS,
    fakebaseClient,
    supabaseClient,
  );
  spinner.stop();

  const rows = reports.map((r) => [r.scenario, statusColor(r.status), r.notes ?? ""]);

  console.log();
  console.log(renderTable(["Scenario", "Status", "Notes"], rows));
  console.log();

  const failures = reports.filter(
    (r) => r.status === "UNSUPPORTED" || r.status === "ERROR",
  );

  if (failures.length > 0) {
    print.error(`${failures.length} scenario(s) reported UNSUPPORTED or ERROR.`);
    process.exitCode = 1;
  } else if (!supabaseClient) {
    print.info(
      "Fakebase-only run complete. Set Supabase env vars for a true comparison.",
    );
  } else {
    print.success("All scenarios passed against live Supabase.");
  }
}
