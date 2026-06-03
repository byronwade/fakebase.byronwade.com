/**
 * JsonAdapter — file-backed snapshot adapter.
 *
 * Each table is persisted as an individual JSON file under a configurable
 * directory (default: `.fakebase/data/`). Reads are served from an in-memory
 * `FakeStore` hydrated synchronously at `initialize()` time. Writes flush the
 * affected table file synchronously (and atomically, via temp-file + rename)
 * after every mutation so data is never silently lost or corrupted. RLS reads
 * are enforced via the shared `PolicyEngine`.
 */

import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  CapabilityError,
  FakeStore,
  FakebaseKernel,
  PolicyEngine,
  SchemaRegistry,
  compileQuery,
  applyFilter,
  type AdapterRow,
  type FakebaseAdapter,
  type Filter,
  type ProjectSchemaIR,
  type QueryOptions,
  type QueryResult,
  type RoleContext,
} from "@byronwade/core";
import { LocalAuthService, MemorySessionStorage } from "@byronwade/auth";
import { LocalStorageService } from "@byronwade/storage";
import type { AuthUser, OtpRecord, BucketRecord, ObjectRecord } from "@byronwade/core";
import type { SignedUrlRecord } from "@byronwade/storage";

/** Options for constructing a JsonAdapter. */
export interface JsonAdapterOptions {
  /** Directory in which snapshot files are stored. Defaults to `.fakebase/data`. */
  dir?: string;
}

/** On-disk snapshot format for a single table. */
interface TableSnapshot {
  schema: string;
  table: string;
  rows: AdapterRow[];
}

/** Generates a pseudo-UUID v4 suitable for development use. */
function pseudoUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * File-backed adapter that uses one JSON file per table.
 *
 * Mutations write through to disk immediately after every operation, so the
 * snapshot directory always reflects the current in-memory state.
 */
export class JsonAdapter implements FakebaseAdapter {
  private readonly dir: string;
  private store = new FakeStore();
  private projectSchema: ProjectSchemaIR | null = null;
  private registry: SchemaRegistry | null = null;
  private policyEngine: PolicyEngine | null = null;
  private roleCtx: RoleContext = { role: "service_role" };
  private rpcHandlers = new Map<string, (args: Record<string, unknown>) => unknown>();

  constructor(options: JsonAdapterOptions = {}) {
    this.dir = options.dir ?? ".fakebase/data";
  }

  setRoleContext(ctx: RoleContext): void {
    this.roleCtx = ctx;
  }

  getCurrentRole(): RoleContext {
    return this.roleCtx;
  }

  /** Register an in-process RPC handler. */
  registerRpc(name: string, handler: (args: Record<string, unknown>) => unknown): void {
    this.rpcHandlers.set(name, handler);
  }

  initialize(schema: ProjectSchemaIR): void {
    this.projectSchema = schema;
    this.registry = new SchemaRegistry(schema);
    this.policyEngine = new PolicyEngine(this.registry);
    this.store = new FakeStore();

    mkdirSync(this.dir, { recursive: true });

    for (const table of schema.tables) {
      this.store.registerTable(table);

      const snapshotPath = this.snapshotPath(table.schema, table.name);
      if (!existsSync(snapshotPath)) continue;
      try {
        const raw = readFileSync(snapshotPath, "utf8");
        const snapshot = JSON.parse(raw) as TableSnapshot;
        for (const row of snapshot.rows) {
          try {
            this.store.insert(table.schema, table.name, row);
          } catch {
            // Skip duplicate rows from a corrupt or outdated snapshot.
          }
        }
      } catch {
        // Ignore unreadable snapshot files; start with an empty table.
      }
    }
  }

  private tableIR(schema: string, table: string) {
    return this.projectSchema?.tables.find(
      (t) => t.schema === schema && t.name === table,
    );
  }

  async insert(
    table: string,
    schema: string,
    rows: AdapterRow[],
  ): Promise<AdapterRow[]> {
    const pk = this.tableIR(schema, table)?.primaryKey ?? "id";
    const inserted: AdapterRow[] = [];
    for (const row of rows) {
      const withDefaults: AdapterRow = { ...row, [pk]: row[pk] ?? pseudoUuid() };
      inserted.push(this.store.insert(schema, table, withDefaults));
    }
    this.flushTable(schema, table);
    return inserted;
  }

  async select(
    table: string,
    schema: string,
    options: QueryOptions,
  ): Promise<QueryResult<AdapterRow>> {
    let rows = this.store.list(schema, table);
    if (this.policyEngine && this.roleCtx.role !== "service_role") {
      rows = rows.filter((row) =>
        this.policyEngine!.evaluateRead(table, schema, row, this.roleCtx),
      );
    }
    return compileQuery(options, rows);
  }

  async update(
    table: string,
    schema: string,
    patch: AdapterRow,
    filters: Filter[],
  ): Promise<AdapterRow[]> {
    const rows = this.store.list(schema, table);
    const pk = this.tableIR(schema, table)?.primaryKey ?? "id";

    const matching =
      filters.length > 0
        ? rows.filter((row) => filters.every((f) => applyFilter(row, f)))
        : rows;

    const updated: AdapterRow[] = [];
    for (const row of matching) {
      const pkValue = row[pk];
      if (pkValue === undefined || pkValue === null) continue;
      updated.push(this.store.update(schema, table, String(pkValue), patch));
    }
    this.flushTable(schema, table);
    return updated;
  }

  async upsert(
    table: string,
    schema: string,
    rows: AdapterRow[],
    onConflict?: string,
  ): Promise<AdapterRow[]> {
    const pk = this.tableIR(schema, table)?.primaryKey ?? "id";
    const conflictKey = onConflict ?? pk;

    const results: AdapterRow[] = [];
    for (const row of rows) {
      const keyValue = row[conflictKey];
      if (keyValue === undefined || keyValue === null) {
        const withPk: AdapterRow = { ...row, [pk]: row[pk] ?? pseudoUuid() };
        results.push(this.store.insert(schema, table, withPk));
        continue;
      }

      const existing =
        conflictKey === pk
          ? this.store.getByPk(schema, table, String(keyValue))
          : this.store.list(schema, table).find((r) => r[conflictKey] === keyValue);

      if (existing) {
        results.push(this.store.update(schema, table, String(existing[pk]), row));
      } else {
        const withPk: AdapterRow = { ...row, [pk]: row[pk] ?? pseudoUuid() };
        results.push(this.store.insert(schema, table, withPk));
      }
    }
    this.flushTable(schema, table);
    return results;
  }

  async delete(
    table: string,
    schema: string,
    filters: Filter[],
  ): Promise<AdapterRow[]> {
    const rows = this.store.list(schema, table);
    const pk = this.tableIR(schema, table)?.primaryKey ?? "id";

    const matching =
      filters.length > 0
        ? rows.filter((row) => filters.every((f) => applyFilter(row, f)))
        : rows;

    const deleted: AdapterRow[] = [];
    for (const row of matching) {
      const pkValue = row[pk];
      if (pkValue === undefined || pkValue === null) continue;
      const result = this.store.delete(schema, table, String(pkValue));
      if (result) deleted.push(result);
    }
    this.flushTable(schema, table);
    return deleted;
  }

  async rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
    const handler = this.rpcHandlers.get(fn);
    if (!handler) throw CapabilityError.notImplemented(`rpc:${fn}`);
    return handler(args);
  }

  exportData(): Record<string, AdapterRow[]> {
    const out: Record<string, AdapterRow[]> = {};
    for (const table of this.projectSchema?.tables ?? []) {
      out[`${table.schema}.${table.name}`] = this.store
        .list(table.schema, table.name)
        .map((r) => ({ ...r }));
    }
    return out;
  }

  importData(data: Record<string, AdapterRow[]>): void {
    for (const table of this.projectSchema?.tables ?? []) {
      const key = `${table.schema}.${table.name}`;
      const rows = data[key];
      if (!rows) continue;
      this.store.truncate(table.schema, table.name);
      for (const row of rows) {
        try {
          this.store.insert(table.schema, table.name, row);
        } catch {
          // ignore duplicates
        }
      }
      this.flushTable(table.schema, table.name);
    }
  }

  async flush(): Promise<void> {
    this.save();
  }

  /** Flush every registered table to disk. */
  save(): void {
    for (const table of this.projectSchema?.tables ?? []) {
      this.flushTable(table.schema, table.name);
    }
  }

  async close(): Promise<void> {
    this.save();
  }

  private flushTable(schema: string, table: string): void {
    const rows = this.store.list(schema, table);
    const snapshot: TableSnapshot = { schema, table, rows };
    const target = this.snapshotPath(schema, table);
    // Atomic write: serialize to a sibling temp file, then rename over the
    // target. `rename` is atomic on the same filesystem, so a crash mid-write
    // can never leave a half-written (corrupt) snapshot — the previous valid
    // file survives until the new one is complete.
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    try {
      writeFileSync(tmp, JSON.stringify(snapshot, null, 2), "utf8");
      renameSync(tmp, target);
    } catch (err) {
      rmSync(tmp, { force: true });
      throw err;
    }
  }

  private snapshotPath(schema: string, table: string): string {
    return join(this.dir, `${schema}.${table}.json`);
  }
}

/**
 * Convenience factory that builds a fully-wired file-backed kernel.
 *
 * @param opts.dir    Directory for table snapshots + storage objects.
 * @param opts.schema Project schema IR.
 */
export function createJsonKernel<Database = unknown>(
  opts: { dir?: string; schema?: ProjectSchemaIR } = {},
): FakebaseKernel<Database> {
  const dir = opts.dir ?? join(tmpdir(), "fakebase-json", randomUUID());
  const adapter = new JsonAdapter({ dir: join(dir, "data") });
  const kernel = new FakebaseKernel<Database>({ adapter, schema: opts.schema });

  const auth = new LocalAuthService(
    new Map<string, AuthUser>(),
    new Map<string, OtpRecord>(),
    new MemorySessionStorage(),
  );
  const storage = new LocalStorageService(
    join(dir, "storage"),
    new Map<string, BucketRecord>(),
    new Map<string, ObjectRecord>(),
    new Map<string, SignedUrlRecord>(),
  );

  kernel.useAuth(auth).useStorage(storage);
  return kernel;
}
