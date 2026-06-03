import { exec } from "node:child_process";
import { promisify } from "node:util";
import { loadConfig } from "../config.js";
import { print } from "../ui/print.js";

const execAsync = promisify(exec);

export async function runStudio(cwd?: string): Promise<void> {
  const config = await loadConfig(cwd);
  const port = config.studioPort ?? 54323;
  const url = `http://localhost:${port}`;

  print.header("Fakebase Studio");
  print.info(`Opening Studio at ${url}`);
  print.step("If the studio is not running, start it with `fakebase dev --studio`");
  console.log();

  const platform = process.platform;
  let openCmd: string;

  if (platform === "darwin") {
    openCmd = `open "${url}"`;
  } else if (platform === "win32") {
    openCmd = `start "" "${url}"`;
  } else {
    openCmd = `xdg-open "${url}"`;
  }

  try {
    await execAsync(openCmd);
    print.success(`Opened ${url} in your default browser`);
  } catch {
    print.warn(`Could not open browser automatically.`);
    print.info(`Visit ${url} manually.`);
    console.log();
    print.step("To build the admin UI, run:");
    print.step("  pnpm --filter @fakebase/studio build");
    print.step("  pnpm --filter @fakebase/studio start");
  }
}
