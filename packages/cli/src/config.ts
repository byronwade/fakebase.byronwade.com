import { readFile, writeFile, access } from "node:fs/promises";
import { resolve, join } from "node:path";

/** Options for schema-driven fake data generation (`fakebase seed gen`). */
export interface SeedGenConfig {
  /** Rows generated per table unless overridden in `tables`. Default 10. */
  rowsPerTable?: number;
  /** Per-table row-count overrides, keyed by table name. */
  tables?: Record<string, number>;
  /** RNG seed for deterministic output. Default 0. */
  seed?: number;
  /** Probability (0–1) that a nullable column is set to null. Default 0. */
  nullRate?: number;
}

export interface FakebaseConfig {
  adapter: "memory" | "json" | "sqlite" | "pglite";
  adapterOptions?: Record<string, unknown>;
  schemaPath?: string;
  seedPath?: string;
  migrationsDir?: string;
  studioPort?: number;
  devPort?: number;
  /** Fake data generation defaults. */
  seedGen?: SeedGenConfig;
}

const DEFAULTS: FakebaseConfig = {
  adapter: "json",
  adapterOptions: { dir: ".fakebase" },
  schemaPath: "fakebase/schema.ts",
  seedPath: "fakebase/seeds/seed.ts",
  migrationsDir: "fakebase/migrations",
  studioPort: 54323,
  devPort: 54321,
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function loadConfig(cwd?: string): Promise<FakebaseConfig> {
  const root = cwd ?? process.cwd();

  const jsonPath = join(root, "fakebase.config.json");
  if (await fileExists(jsonPath)) {
    try {
      const raw = await readFile(jsonPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<FakebaseConfig>;
      return { ...DEFAULTS, ...parsed };
    } catch (err) {
      throw new Error(
        `Failed to parse fakebase.config.json: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const tsPath = join(root, "fakebase.config.ts");
  if (await fileExists(tsPath)) {
    try {
      const mod = (await import(resolve(tsPath))) as
        | { default?: Partial<FakebaseConfig> }
        | Partial<FakebaseConfig>;
      const userConfig = ("default" in mod ? mod.default : mod) ?? {};
      return { ...DEFAULTS, ...userConfig };
    } catch {
      // TS config can't be imported at runtime without a loader — fall back to defaults
    }
  }

  return { ...DEFAULTS };
}

export async function writeDefaultConfig(cwd?: string): Promise<void> {
  const root = cwd ?? process.cwd();
  const jsonPath = join(root, "fakebase.config.json");
  const content = JSON.stringify(DEFAULTS, null, 2) + "\n";
  await writeFile(jsonPath, content, "utf8");
}
