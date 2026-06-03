import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, writeDefaultConfig } from "../config.js";
import type { FakebaseConfig } from "../config.js";

let testDir: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `fakebase-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("returns defaults when no config file exists", async () => {
    const config = await loadConfig(testDir);

    expect(config.adapter).toBe("json");
    expect(config.devPort).toBe(54321);
    expect(config.studioPort).toBe(54323);
    expect(config.schemaPath).toBe("fakebase/schema.ts");
    expect(config.seedPath).toBe("fakebase/seeds/seed.ts");
    expect(config.migrationsDir).toBe("fakebase/migrations");
  });

  it("reads fakebase.config.json and merges with defaults", async () => {
    const userConfig: Partial<FakebaseConfig> = {
      adapter: "memory",
      devPort: 9000,
    };
    await writeFile(
      join(testDir, "fakebase.config.json"),
      JSON.stringify(userConfig, null, 2),
      "utf8",
    );

    const config = await loadConfig(testDir);

    expect(config.adapter).toBe("memory");
    expect(config.devPort).toBe(9000);
    // defaults preserved
    expect(config.studioPort).toBe(54323);
    expect(config.schemaPath).toBe("fakebase/schema.ts");
  });

  it("throws on invalid JSON in config file", async () => {
    await writeFile(join(testDir, "fakebase.config.json"), "{ invalid json }", "utf8");

    await expect(loadConfig(testDir)).rejects.toThrow(
      /Failed to parse fakebase.config.json/,
    );
  });

  it("preserves adapterOptions from JSON config", async () => {
    const userConfig: Partial<FakebaseConfig> = {
      adapter: "json",
      adapterOptions: { dir: "custom-dir" },
    };
    await writeFile(
      join(testDir, "fakebase.config.json"),
      JSON.stringify(userConfig),
      "utf8",
    );

    const config = await loadConfig(testDir);
    expect(config.adapterOptions?.["dir"]).toBe("custom-dir");
  });
});

describe("writeDefaultConfig", () => {
  it("writes a fakebase.config.json with default values", async () => {
    await writeDefaultConfig(testDir);

    const config = await loadConfig(testDir);
    expect(config.adapter).toBe("json");
    expect(config.devPort).toBe(54321);
  });

  it("written config is valid JSON", async () => {
    await writeDefaultConfig(testDir);

    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(join(testDir, "fakebase.config.json"), "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});
