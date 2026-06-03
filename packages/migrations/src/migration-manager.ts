/**
 * MigrationManager — manages timestamped SQL migration files on disk.
 *
 * Mirrors the Supabase CLI convention: migrations live under a directory as
 * `<timestamp>_<name>.sql`, applied in lexical (timestamp) order. The manager
 * can create new migration files, list them, generate a migration from a
 * schema diff, and track which migrations have been applied via a JSON ledger.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectSchemaIR } from "@byronwade/core";
import { diffSchemas, diffToSql, isSchemaDiffEmpty } from "./diff.js";

/** Metadata describing a single migration file. */
export interface MigrationRecord {
  /** Timestamp version prefix, e.g. `20260601120000`. */
  version: string;
  /** Human-readable migration name. */
  name: string;
  /** File name, e.g. `20260601120000_add_profiles.sql`. */
  fileName: string;
  /** ISO timestamp the migration was applied, or null when pending. */
  appliedAt: string | null;
}

const EMPTY_SCHEMA: ProjectSchemaIR = {
  version: 0,
  tables: [],
  enums: [],
  functions: [],
};

/**
 * Manages a directory of SQL migration files plus an applied-migrations ledger.
 */
export class MigrationManager {
  constructor(private readonly migrationsDir: string) {}

  private ledgerPath(): string {
    return join(this.migrationsDir, ".applied.json");
  }

  private async ensureDir(): Promise<void> {
    if (!existsSync(this.migrationsDir)) {
      await mkdir(this.migrationsDir, { recursive: true });
    }
  }

  /** Generate a UTC timestamp version string (`YYYYMMDDHHmmss`). */
  static version(date = new Date()): string {
    const pad = (n: number): string => String(n).padStart(2, "0");
    return [
      String(date.getUTCFullYear()),
      pad(date.getUTCMonth() + 1),
      pad(date.getUTCDate()),
      pad(date.getUTCHours()),
      pad(date.getUTCMinutes()),
      pad(date.getUTCSeconds()),
    ].join("");
  }

  private static slug(name: string): string {
    return (
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 60) || "migration"
    );
  }

  private static parseFileName(
    fileName: string,
  ): { version: string; name: string } | null {
    const m = fileName.match(/^(\d{8,})_(.+)\.sql$/);
    if (!m) return null;
    return { version: m[1]!, name: m[2]! };
  }

  /**
   * Create a new migration file containing the given SQL (or a stub when no
   * SQL is provided). Returns the resulting {@link MigrationRecord}.
   */
  async create(name: string, sql = ""): Promise<MigrationRecord> {
    await this.ensureDir();
    const version = MigrationManager.version();
    const slug = MigrationManager.slug(name);
    const fileName = `${version}_${slug}.sql`;
    const body =
      sql.trim().length > 0
        ? `${sql.trimEnd()}\n`
        : `-- Migration: ${name}\n-- Created: ${new Date().toISOString()}\n\n`;
    await writeFile(join(this.migrationsDir, fileName), body, "utf-8");
    return { version, name: slug, fileName, appliedAt: null };
  }

  /**
   * Generate a migration from the diff between two schema snapshots.
   * Returns `null` when there is no difference to migrate.
   */
  async createFromDiff(
    name: string,
    before: ProjectSchemaIR | null,
    after: ProjectSchemaIR,
  ): Promise<MigrationRecord | null> {
    const diff = diffSchemas(before ?? EMPTY_SCHEMA, after);
    if (isSchemaDiffEmpty(diff)) return null;
    const sql = diffToSql(diff);
    return this.create(name, sql);
  }

  /** List all migration files (sorted by version), with applied status. */
  async list(): Promise<MigrationRecord[]> {
    await this.ensureDir();
    let entries: string[];
    try {
      entries = await readdir(this.migrationsDir);
    } catch {
      return [];
    }

    const applied = await this.readLedger();
    const records: MigrationRecord[] = [];
    for (const fileName of entries) {
      const parsed = MigrationManager.parseFileName(fileName);
      if (!parsed) continue;
      records.push({
        version: parsed.version,
        name: parsed.name,
        fileName,
        appliedAt: applied[parsed.version] ?? null,
      });
    }
    return records.sort((a, b) => a.version.localeCompare(b.version));
  }

  /** Read the raw SQL of a migration by file name. */
  async read(fileName: string): Promise<string> {
    return readFile(join(this.migrationsDir, fileName), "utf-8");
  }

  /** Return migrations that have not yet been marked applied. */
  async pending(): Promise<MigrationRecord[]> {
    return (await this.list()).filter((m) => m.appliedAt === null);
  }

  /** Mark a migration version as applied in the ledger. */
  async markApplied(version: string): Promise<void> {
    const ledger = await this.readLedger();
    ledger[version] = new Date().toISOString();
    await this.writeLedger(ledger);
  }

  private async readLedger(): Promise<Record<string, string>> {
    try {
      const raw = await readFile(this.ledgerPath(), "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, string>;
      }
    } catch {
      // No ledger yet.
    }
    return {};
  }

  private async writeLedger(ledger: Record<string, string>): Promise<void> {
    await this.ensureDir();
    await writeFile(this.ledgerPath(), JSON.stringify(ledger, null, 2), "utf-8");
  }
}
