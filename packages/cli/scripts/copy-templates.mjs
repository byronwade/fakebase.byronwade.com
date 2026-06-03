/**
 * Copy non-TypeScript template assets (`*.template`) from `src/templates` into
 * `dist/templates` after `tsc` runs. `tsc` only emits `.ts` files, so these
 * raw templates would otherwise be missing at runtime.
 */
import { cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "..", "src", "templates");
const destDir = join(here, "..", "dist", "templates");

if (existsSync(srcDir)) {
  cpSync(srcDir, destDir, {
    recursive: true,
    // Skip compiled sources; only copy raw template assets.
    filter: (src) => !src.endsWith(".ts") || src.endsWith(".template"),
  });
}
