/**
 * PGliteAdapter — Postgres-in-WASM adapter for Fakebase.
 *
 * PGlite runs a real Postgres engine compiled to WebAssembly, giving the
 * highest SQL fidelity of any Fakebase adapter (true Postgres parser, planner,
 * `jsonb`, window functions, etc.) with **no native build step** — it runs the
 * same on macOS, Linux, and Windows.
 *
 * Because PGlite is asynchronous to boot, `initialize()` kicks off the bootstrap
 * and stores a readiness promise; every data operation awaits it first. This
 * preserves the synchronous-construction ergonomics of the other adapters while
 * remaining safe.
 *
 * RLS is evaluated in JS via the shared `PolicyEngine` (identical to the other
 * adapters) so behaviour stays consistent across the contract suite, rather
 * than relying on Postgres roles.
 */

import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { PGlite } from "@electric-sql/pglite";

import {
  CapabilityError,
  FakebaseKernel,
  PolicyEngine,
  SchemaRegistry,
  applyFilter,
  type AdapterRow,
  type AuthUser,
  type BucketRecord,
  type FakebaseAdapter,
  type Filter,
  type FilterNode,
  type ObjectRecord,
  type OtpRecord,
  type ProjectSchemaIR,
  type QueryOptions,
  type QueryResult,
  type RoleContext,
  type TableIR,
} from "@fakebase/core";
import { LocalAuthService, MemorySessionStorage } from "@fakebase/auth";
import { LocalStorageService } from "@fakebase/storage";
import type { SignedUrlRecord } from "@fakebase/storage";

import { deserializeValue, mapColumnType, serializeValue } from "./type-mapping.js";

const DEFAULT_DATA_DIR = ".fakebase/pglite";

/**
 * Translate a Postgres-style `defaultSql` expression into a concrete JS value
 * so it can be applied at insert time. Returns `undefined` for expressions we
 * can't evaluate locally (the column is then left to Postgres/NOT NULL rules).
 */
function evalDefaultSql(defaultSql: string): unknown | undefined {
  const raw = defaultSql.trim();
  const lower = raw.toLowerCase();

  if (lower === "gen_random_uuid()" || lower === "uuid_generate_v4()") {
    return randomUUID();
  }
  if (lower === "now()" || lower === "current_timestamp") {
    return new Date().toISOString();
  }
  if (lower === "true") return true;
  if (lower === "false") return false;
  if (lower === "null") return null;

  const quoted = raw.match(/^'((?:[^']|'')*)'(?:::[a-zA-Z_ ]+)?$/);
  if (quoted) return quoted[1].replace(/''/g, "'");

  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);

  return undefined;
}

/** Operators that can be pushed directly into a SQL WHERE clause. */
const SQL_OPERATORS = new Set([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "like",
  "ilike",
  "is",
  "in",
]);

interface SqlFilter {
  column: string;
  operator: string;
  value: unknown;
}

interface SplitFilters {
  sql: SqlFilter[];
  js: Filter[];
}

function isSqlableLeaf(f: Filter): boolean {
  if ("type" in f) return false; // Or / And / Not — evaluated in JS
  return SQL_OPERATORS.has((f as FilterNode).operator);
}

function splitFilters(filters: Filter[]): SplitFilters {
  const sql: SqlFilter[] = [];
  const js: Filter[] = [];
  for (const f of filters) {
    if (isSqlableLeaf(f)) {
      const leaf = f as FilterNode;
      sql.push({ column: leaf.column, operator: leaf.operator, value: leaf.value });
    } else {
      js.push(f);
    }
  }
  return { sql, js };
}

/**
 * Build a Postgres WHERE clause using `$N` placeholders, starting after
 * `offset` existing parameters.
 */
function buildWhereClause(
  sqlFilters: SqlFilter[],
  offset = 0,
): { clause: string; params: unknown[] } {
  if (sqlFilters.length === 0) return { clause: "", params: [] };

  const parts: string[] = [];
  const params: unknown[] = [];
  let n = offset;
  const ph = (value: unknown): string => {
    params.push(value);
    return `$${++n}`;
  };

  for (const f of sqlFilters) {
    const col = `"${f.column}"`;
    switch (f.operator) {
      case "eq":
        parts.push(`${col} = ${ph(f.value)}`);
        break;
      case "neq":
        parts.push(`${col} <> ${ph(f.value)}`);
        break;
      case "gt":
        parts.push(`${col} > ${ph(f.value)}`);
        break;
      case "gte":
        parts.push(`${col} >= ${ph(f.value)}`);
        break;
      case "lt":
        parts.push(`${col} < ${ph(f.value)}`);
        break;
      case "lte":
        parts.push(`${col} <= ${ph(f.value)}`);
        break;
      case "like":
        parts.push(`${col} LIKE ${ph(f.value)}`);
        break;
      case "ilike":
        parts.push(`${col} ILIKE ${ph(f.value)}`);
        break;
      case "is":
        if (f.value === null || f.value === "null") {
          parts.push(`${col} IS NULL`);
        } else if (f.value === true || f.value === "true") {
          parts.push(`${col} IS TRUE`);
        } else if (f.value === false || f.value === "false") {
          parts.push(`${col} IS FALSE`);
        } else {
          parts.push(`${col} IS ${ph(f.value)}`);
        }
        break;
      case "in": {
        const arr = Array.isArray(f.value)
          ? f.value
          : typeof f.value === "string"
            ? f.value.split(",").map((s) => s.trim())
            : [f.value];
        if (arr.length === 0) {
          parts.push("FALSE");
        } else {
          parts.push(`${col} IN (${arr.map((v) => ph(v)).join(", ")})`);
        }
        break;
      }
      default:
        break;
    }
  }

  const clause = parts.length > 0 ? `WHERE ${parts.join(" AND ")}` : "";
  return { clause, params };
}

export class PGliteAdapter implements FakebaseAdapter {
  private db: PGlite | null = null;
  private ready: Promise<void> | null = null;
  private schema: ProjectSchemaIR | null = null;
  private registry: SchemaRegistry | null = null;
  private policyEngine: PolicyEngine | null = null;
  private roleCtx: RoleContext = { role: "service_role" };
  private readonly dataDir: string | undefined;

  constructor(options: { dataDir?: string } = {}) {
    this.dataDir = options.dataDir ?? DEFAULT_DATA_DIR;
  }

  setRoleContext(ctx: RoleContext): void {
    this.roleCtx = ctx;
  }

  getCurrentRole(): RoleContext {
    return this.roleCtx;
  }

  initialize(schema: ProjectSchemaIR): void {
    this.schema = schema;
    this.registry = new SchemaRegistry(schema);
    this.policyEngine = new PolicyEngine(this.registry);
    this.ready = this.bootstrap(schema);
    // Prevent an unhandled rejection before the first operation awaits `ready`;
    // the error is still surfaced by `ensureReady()`.
    void this.ready.catch(() => undefined);
  }

  private async bootstrap(schema: ProjectSchemaIR): Promise<void> {
    if (this.dataDir && !this.dataDir.includes("://")) {
      mkdirSync(this.dataDir, { recursive: true });
    }
    this.db = new PGlite(this.dataDir);
    await this.db.waitReady;

    for (const table of schema.tables) {
      await this.createTable(table);
    }
  }

  private async ensureReady(): Promise<PGlite> {
    if (!this.ready) {
      throw new Error("PGliteAdapter not initialized. Call initialize() first.");
    }
    await this.ready;
    if (!this.db) {
      throw new Error("PGliteAdapter database is not available.");
    }
    return this.db;
  }

  private rlsActive(table: string, schema: string): boolean {
    return (
      this.roleCtx.role !== "service_role" &&
      !!this.policyEngine &&
      this.policyEngine.isRlsEnabled(table, schema)
    );
  }

  private getTableIR(table: string, schema: string): TableIR | undefined {
    return this.schema?.tables.find((t) => t.name === table && t.schema === schema);
  }

  private tableRef(table: string, schema: string): string {
    return `"${schema}"."${table}"`;
  }

  private async createTable(table: TableIR): Promise<void> {
    const db = this.db!;
    if (table.schema !== "public") {
      await db.exec(`CREATE SCHEMA IF NOT EXISTS "${table.schema}";`);
    }

    // Defaults are applied in JS (see `applyDefaults`) and foreign keys are
    // omitted, mirroring the other adapters so behaviour stays identical.
    const columnDefs = table.columns.map((col) => {
      const parts: string[] = [`"${col.name}" ${mapColumnType(col.type)}`];
      if (col.primaryKey) parts.push("PRIMARY KEY");
      else if (!col.nullable) parts.push("NOT NULL");
      if (col.unique && !col.primaryKey) parts.push("UNIQUE");
      return parts.join(" ");
    });

    await db.exec(
      `CREATE TABLE IF NOT EXISTS ${this.tableRef(table.name, table.schema)} (\n  ${columnDefs.join(",\n  ")}\n);`,
    );

    for (const idx of table.indexes) {
      const cols = idx.columns.map((c) => `"${c}"`).join(", ");
      const unique = idx.unique ? "UNIQUE " : "";
      await db.exec(
        `CREATE ${unique}INDEX IF NOT EXISTS "${idx.name}" ON ${this.tableRef(table.name, table.schema)} (${cols});`,
      );
    }
  }

  /**
   * Fill omitted columns with their schema default, mirroring how Postgres
   * applies `DEFAULT` clauses. Only columns absent from the row are touched —
   * an explicit `null` is preserved.
   */
  private applyDefaults(row: AdapterRow, tableIR: TableIR | undefined): AdapterRow {
    if (!tableIR) return row;
    const out: AdapterRow = { ...row };
    for (const col of tableIR.columns) {
      if (out[col.name] === undefined && col.defaultSql) {
        const value = evalDefaultSql(col.defaultSql);
        if (value !== undefined) out[col.name] = value;
      }
    }
    return out;
  }

  private serializeRow(row: AdapterRow, tableIR: TableIR | undefined): AdapterRow {
    if (!tableIR) return row;
    const out: AdapterRow = {};
    for (const [key, value] of Object.entries(row)) {
      const col = tableIR.columns.find((c) => c.name === key);
      out[key] = col ? serializeValue(value, col.type) : value;
    }
    return out;
  }

  private deserializeRow(row: AdapterRow, tableIR: TableIR | undefined): AdapterRow {
    if (!tableIR) return row;
    const out: AdapterRow = {};
    for (const [key, value] of Object.entries(row)) {
      const col = tableIR.columns.find((c) => c.name === key);
      out[key] = col ? deserializeValue(value, col.type) : value;
    }
    return out;
  }

  async insert(
    table: string,
    schema: string,
    rows: AdapterRow[],
  ): Promise<AdapterRow[]> {
    const db = await this.ensureReady();
    const tableIR = this.getTableIR(table, schema);
    const ref = this.tableRef(table, schema);
    const pk = tableIR?.primaryKey ?? "id";

    const results: AdapterRow[] = [];
    for (const row of rows) {
      const serialized = this.serializeRow(this.applyDefaults(row, tableIR), tableIR);
      const keys = Object.keys(serialized);
      if (keys.length === 0) continue;
      const columns = keys.map((k) => `"${k}"`).join(", ");
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      const values = keys.map((k) => serialized[k]);

      const res = await db.query<AdapterRow>(
        `INSERT INTO ${ref} (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING RETURNING *`,
        values,
      );

      if (res.rows.length > 0) {
        results.push(this.deserializeRow(res.rows[0]!, tableIR));
      } else {
        const pkValue = serialized[pk];
        if (pkValue !== undefined && pkValue !== null) {
          const found = await db.query<AdapterRow>(
            `SELECT * FROM ${ref} WHERE "${pk}" = $1`,
            [pkValue],
          );
          if (found.rows[0]) {
            results.push(this.deserializeRow(found.rows[0], tableIR));
          }
        }
      }
    }

    return results;
  }

  async select(
    table: string,
    schema: string,
    options: QueryOptions,
  ): Promise<QueryResult<AdapterRow>> {
    const db = await this.ensureReady();
    const tableIR = this.getTableIR(table, schema);
    const ref = this.tableRef(table, schema);

    const { sql: sqlFilters, js: jsFilters } = splitFilters(options.filters);
    const { clause, params } = buildWhereClause(sqlFilters);

    // When RLS is active we filter rows in JS *before* applying limit/offset,
    // so pagination is pushed to the JS side in that case.
    const rls = this.rlsActive(table, schema);

    let sqlQuery = `SELECT * FROM ${ref} ${clause}`;

    if (options.orderBy && options.orderBy.length > 0) {
      const orderParts = options.orderBy.map((o) => {
        const dir = o.ascending ? "ASC" : "DESC";
        const nulls = o.nullsFirst ? "NULLS FIRST" : "NULLS LAST";
        return `"${o.column}" ${dir} ${nulls}`;
      });
      sqlQuery += ` ORDER BY ${orderParts.join(", ")}`;
    }

    if (!rls && options.limit !== undefined) {
      sqlQuery += ` LIMIT ${options.limit}`;
    }
    if (!rls && options.offset !== undefined) {
      sqlQuery += ` OFFSET ${options.offset}`;
    }

    const queryResult = await db.query<AdapterRow>(sqlQuery, params);
    let rows = queryResult.rows.map((r) => this.deserializeRow(r, tableIR));

    if (jsFilters.length > 0) {
      rows = rows.filter((row) =>
        jsFilters.every((f) => applyFilter(row as Record<string, unknown>, f)),
      );
    }

    if (rls) {
      rows = rows.filter((row) =>
        this.policyEngine!.evaluateRead(table, schema, row, this.roleCtx),
      );
      const offset = options.offset ?? 0;
      const end = options.limit !== undefined ? offset + options.limit : undefined;
      rows = rows.slice(offset, end);
    }

    const totalBeforeProjection = rows.length;

    if (options.select && options.select.length > 0) {
      rows = rows.map((row) => {
        const projected: AdapterRow = {};
        for (const col of options.select!) {
          projected[col] = row[col];
        }
        return projected;
      });
    }

    const count = options.count ? totalBeforeProjection : null;

    return {
      data: rows as AdapterRow[],
      error: null,
      count,
      status: 200,
      statusText: "OK",
    };
  }

  async update(
    table: string,
    schema: string,
    patch: AdapterRow,
    filters: Filter[],
  ): Promise<AdapterRow[]> {
    const db = await this.ensureReady();
    const tableIR = this.getTableIR(table, schema);
    const ref = this.tableRef(table, schema);

    const { sql: sqlFilters, js: jsFilters } = splitFilters(filters);
    const { clause, params } = buildWhereClause(sqlFilters);

    let candidates = (
      await db.query<AdapterRow>(`SELECT * FROM ${ref} ${clause}`, params)
    ).rows.map((r) => this.deserializeRow(r, tableIR));

    if (jsFilters.length > 0) {
      candidates = candidates.filter((row) =>
        jsFilters.every((f) => applyFilter(row as Record<string, unknown>, f)),
      );
    }

    if (candidates.length === 0) return [];

    const serializedPatch = this.serializeRow(patch, tableIR);
    const patchKeys = Object.keys(serializedPatch);
    if (patchKeys.length === 0) return candidates;

    const setClause = patchKeys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
    const pk = tableIR?.primaryKey ?? "id";

    const updated: AdapterRow[] = [];
    for (const row of candidates) {
      const res = await db.query<AdapterRow>(
        `UPDATE ${ref} SET ${setClause} WHERE "${pk}" = $${patchKeys.length + 1} RETURNING *`,
        [...patchKeys.map((k) => serializedPatch[k]), row[pk]],
      );
      if (res.rows[0]) updated.push(this.deserializeRow(res.rows[0], tableIR));
    }

    return updated;
  }

  async upsert(
    table: string,
    schema: string,
    rows: AdapterRow[],
    onConflict?: string,
  ): Promise<AdapterRow[]> {
    const db = await this.ensureReady();
    const tableIR = this.getTableIR(table, schema);
    const ref = this.tableRef(table, schema);
    const pk = tableIR?.primaryKey ?? "id";
    const conflictCol = onConflict ?? pk;

    const results: AdapterRow[] = [];
    for (const row of rows) {
      const serialized = this.serializeRow(this.applyDefaults(row, tableIR), tableIR);
      const keys = Object.keys(serialized);
      if (keys.length === 0) continue;
      const columns = keys.map((k) => `"${k}"`).join(", ");
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      const values = keys.map((k) => serialized[k]);

      const updateSet = keys
        .filter((k) => k !== conflictCol)
        .map((k) => `"${k}" = excluded."${k}"`)
        .join(", ");

      const sql = updateSet
        ? `INSERT INTO ${ref} (${columns}) VALUES (${placeholders}) ON CONFLICT ("${conflictCol}") DO UPDATE SET ${updateSet} RETURNING *`
        : `INSERT INTO ${ref} (${columns}) VALUES (${placeholders}) ON CONFLICT ("${conflictCol}") DO NOTHING RETURNING *`;

      const res = await db.query<AdapterRow>(sql, values);
      if (res.rows[0]) {
        results.push(this.deserializeRow(res.rows[0], tableIR));
      } else {
        const pkValue = serialized[pk];
        if (pkValue !== undefined && pkValue !== null) {
          const found = await db.query<AdapterRow>(
            `SELECT * FROM ${ref} WHERE "${pk}" = $1`,
            [pkValue],
          );
          if (found.rows[0]) {
            results.push(this.deserializeRow(found.rows[0], tableIR));
          }
        }
      }
    }

    return results;
  }

  async delete(
    table: string,
    schema: string,
    filters: Filter[],
  ): Promise<AdapterRow[]> {
    const db = await this.ensureReady();
    const tableIR = this.getTableIR(table, schema);
    const ref = this.tableRef(table, schema);

    const { sql: sqlFilters, js: jsFilters } = splitFilters(filters);
    const { clause, params } = buildWhereClause(sqlFilters);

    let candidates = (
      await db.query<AdapterRow>(`SELECT * FROM ${ref} ${clause}`, params)
    ).rows.map((r) => this.deserializeRow(r, tableIR));

    if (jsFilters.length > 0) {
      candidates = candidates.filter((row) =>
        jsFilters.every((f) => applyFilter(row as Record<string, unknown>, f)),
      );
    }

    if (candidates.length === 0) return [];

    const pk = tableIR?.primaryKey ?? "id";
    for (const row of candidates) {
      await db.query(`DELETE FROM ${ref} WHERE "${pk}" = $1`, [row[pk]]);
    }

    return candidates;
  }

  async rpc(_fn: string, _args: Record<string, unknown>): Promise<unknown> {
    throw CapabilityError.notImplemented("rpc");
  }

  async flush(): Promise<void> {
    // PGlite persists to its data directory automatically; nothing to flush.
  }

  async close(): Promise<void> {
    if (this.ready) {
      try {
        await this.ready;
      } catch {
        // bootstrap failed; nothing to close.
      }
    }
    await this.db?.close();
    this.db = null;
    this.ready = null;
  }
}

export interface CreatePGliteKernelOptions {
  /** Filesystem directory for the PGlite data files. Omit for in-memory. */
  dataDir?: string;
  schema?: ProjectSchemaIR;
  /** Directory for storage objects. Defaults to a temp dir. */
  storageDir?: string;
}

/**
 * Build a fully-wired PGlite-backed kernel (data + auth + storage + realtime +
 * functions). Synchronous, mirroring `createSqliteKernel`; the adapter boots
 * its WASM Postgres lazily and the first query awaits readiness.
 */
export function createPGliteKernel<Database = unknown>(
  opts: CreatePGliteKernelOptions = {},
): FakebaseKernel<Database> {
  const adapter = new PGliteAdapter({ dataDir: opts.dataDir });
  const kernel = new FakebaseKernel<Database>({ adapter, schema: opts.schema });

  const auth = new LocalAuthService(
    new Map<string, AuthUser>(),
    new Map<string, OtpRecord>(),
    new MemorySessionStorage(),
  );
  const storage = new LocalStorageService(
    opts.storageDir ?? join(tmpdir(), "fakebase-pglite-storage", randomUUID()),
    new Map<string, BucketRecord>(),
    new Map<string, ObjectRecord>(),
    new Map<string, SignedUrlRecord>(),
  );

  kernel.useAuth(auth).useStorage(storage);
  return kernel;
}
