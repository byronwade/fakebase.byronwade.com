import { readFile, writeFile, readdir, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { ProjectSchemaIR } from "@byronwade/core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SnapshotManifest {
  /** The label the snapshot was saved under — its stable identity. */
  label: string;
  version: string;
  createdAt: string;
  schemaVersion: number;
  tables: string[];
}

interface SnapshotFile {
  manifest: SnapshotManifest;
  schema: ProjectSchemaIR;
  data: Record<string, unknown[]>;
}

// ---------------------------------------------------------------------------
// SnapshotManager
// ---------------------------------------------------------------------------

/**
 * Saves and restores named snapshots of the current schema IR and row data.
 *
 * Each snapshot is stored as a single JSON file `<label>.snapshot.json` inside
 * the snapshots directory. An optional `manifest.json` index is maintained for
 * quick listing without reading every file.
 */
export class SnapshotManager {
  constructor(private readonly snapshotsDir: string) {}

  private async ensureDir(): Promise<void> {
    if (!existsSync(this.snapshotsDir)) {
      await mkdir(this.snapshotsDir, { recursive: true });
    }
  }

  /** Sanitized, filesystem- and identity-safe key derived from a label. Two
   *  labels that map to the same key share the same snapshot file. */
  private key(label: string): string {
    return String(label ?? "")
      .replace(/[^a-z0-9_-]/gi, "_")
      .toLowerCase();
  }

  private snapshotPath(label: string): string {
    return join(this.snapshotsDir, `${this.key(label)}.snapshot.json`);
  }

  private manifestPath(): string {
    return join(this.snapshotsDir, "manifest.json");
  }

  private generateVersion(): string {
    const now = new Date();
    const pad = (n: number): string => String(n).padStart(2, "0");
    return [
      String(now.getUTCFullYear()),
      pad(now.getUTCMonth() + 1),
      pad(now.getUTCDate()),
      pad(now.getUTCHours()),
      pad(now.getUTCMinutes()),
      pad(now.getUTCSeconds()),
    ].join("");
  }

  private async readManifests(): Promise<SnapshotManifest[]> {
    try {
      const raw = await readFile(this.manifestPath(), "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed as SnapshotManifest[];
    } catch {
      // First use
    }
    return [];
  }

  private async writeManifests(manifests: SnapshotManifest[]): Promise<void> {
    await writeFile(this.manifestPath(), JSON.stringify(manifests, null, 2), "utf-8");
  }

  /**
   * Save a snapshot under the given label.
   * Returns the version string assigned to this snapshot.
   */
  async save(
    label: string,
    schemaIR: ProjectSchemaIR,
    data: Record<string, unknown[]>,
  ): Promise<string> {
    await this.ensureDir();

    const version = this.generateVersion();
    const createdAt = new Date().toISOString();
    const tables = Object.keys(data);

    const manifest: SnapshotManifest = {
      label,
      version,
      createdAt,
      schemaVersion: schemaIR.version,
      tables,
    };

    const file: SnapshotFile = { manifest, schema: schemaIR, data };
    await writeFile(this.snapshotPath(label), JSON.stringify(file, null, 2), "utf-8");

    // Replace any existing entry for the same label (snapshots are keyed by
    // their sanitized label, which is also their filename).
    const key = this.key(label);
    const manifests = await this.readManifests();
    const updatedManifests = [
      ...manifests.filter((m) => this.key(m.label) !== key),
      manifest,
    ];
    await this.writeManifests(updatedManifests);

    return version;
  }

  /** List all snapshots from the manifest index. */
  async list(): Promise<SnapshotManifest[]> {
    await this.ensureDir();

    // Fall back to scanning directory if no manifest file
    if (!existsSync(this.manifestPath())) {
      let entries: string[];
      try {
        entries = await readdir(this.snapshotsDir);
      } catch {
        return [];
      }

      const results: SnapshotManifest[] = [];
      for (const entry of entries) {
        if (!entry.endsWith(".snapshot.json")) continue;
        try {
          const raw = await readFile(join(this.snapshotsDir, entry), "utf-8");
          const file = JSON.parse(raw) as SnapshotFile;
          results.push(file.manifest);
        } catch {
          continue;
        }
      }
      return results;
    }

    return this.readManifests();
  }

  /**
   * Restore a snapshot by label.
   * Returns `null` when the label is not found.
   */
  async restore(
    label: string,
  ): Promise<{ schema: ProjectSchemaIR; data: Record<string, unknown[]> } | null> {
    const path = this.snapshotPath(label);
    if (!existsSync(path)) return null;

    try {
      const raw = await readFile(path, "utf-8");
      const file = JSON.parse(raw) as SnapshotFile;
      return { schema: file.schema, data: file.data };
    } catch {
      return null;
    }
  }

  /** Delete a snapshot and remove it from the manifest. */
  async delete(label: string): Promise<void> {
    const path = this.snapshotPath(label);
    try {
      await rm(path, { force: true });
    } catch {
      // Ignore missing file
    }

    const key = this.key(label);
    const manifests = await this.readManifests();
    const updated = manifests.filter((m) => this.key(m.label) !== key);
    await this.writeManifests(updated);
  }
}
