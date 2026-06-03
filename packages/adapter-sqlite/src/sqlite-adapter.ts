import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

import Database from "better-sqlite3";
import type { Database as BetterSqlite3Database } from "better-sqlite3";

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
} from "@byronwade/core";
import { LocalAuthService, MemorySessionStorage } from "@byronwade/auth";
import { LocalStorageService } from "@byronwade/storage";
import type { SignedUrlRecord } from "@byronwade/storage";

import { deserializeValue, mapColumnType, serializeValue } from "./type-mapping.js";

const DEFAULT_DB_PATH = ".fakebase/fakebase.db";

/**
 * Translate a Postgres-style `defaultSql` expression into a concrete JS value
 * so it can be applied at insert time. Returns `undefined` for expressions we
 * can't evaluate locally (the column is then left to SQLite/NOT NULL rules).
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

  // String literal, optionally cast: 'user'  or  'user'::text
  const quoted = raw.match(/^'((?:[^']|'')*)'(?:::[a-zA-Z_ ]+)?$/);
  if (quoted) return quoted[1].replace(/''/g, "'");

  // Numeric literal
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
  if ("type" in f) return false; // Or / And / Not — handle as JS for now
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

function buildWhereClause(sqlFilters: SqlFilter[]): {
  clause: string;
  params: unknown[];
} {
  if (sqlFilters.length === 0) return { clause: "", params: [] };

  const parts: string[] = [];
  const params: unknown[] = [];

  for (const f of sqlFilters) {
    const col = `"${f.column}"`;
    switch (f.operator) {
      case "eq":
        parts.push(`${col} = ?`);
        params.push(f.value);
        break;
      case "neq":
        parts.push(`${col} != ?`);
        params.push(f.value);
        break;
      case "gt":
        parts.push(`${col} > ?`);
        params.push(f.value);
        break;
      case "gte":
        parts.push(`${col} >= ?`);
        params.push(f.value);
        break;
      case "lt":
        parts.push(`${col} < ?`);
        params.push(f.value);
        break;
      case "lte":
        parts.push(`${col} <= ?`);
        params.push(f.value);
        break;
      case "like":
        parts.push(`${col} LIKE ?`);
        params.push(f.value);
        break;
      case "ilike":
        parts.push(`${col} LIKE ? COLLATE NOCASE`);
        params.push(f.value);
        break;
      case "is":
        if (f.value === null || f.value === "null") {
          parts.push(`${col} IS NULL`);
        } else if (f.value === true || f.value === "true") {
          parts.push(`${col} = 1`);
        } else if (f.value === false || f.value === "false") {
          parts.push(`${col} = 0`);
        } else {
          parts.push(`${col} IS ?`);
          params.push(f.value);
        }
        break;
      case "in": {
        const arr = Array.isArray(f.value)
          ? f.value
          : typeof f.value === "string"
            ? f.value.split(",").map((s) => s.trim())
            : [f.value];
        if (arr.length === 0) {
          parts.push("0 = 1");
        } else {
          parts.push(`${col} IN (${arr.map(() => "?").join(",")})`);
          params.push(...arr);
        }
        break;
      }
      default:
        break;
    }
  }

  return { clause: `WHERE ${parts.join(" AND ")}`, params };
}

export class SqliteAdapter implements FakebaseAdapter {
  private db: BetterSqlite3Database | null = null;
  private schema: ProjectSchemaIR | null = null;
  private registry: SchemaRegistry | null = null;
  private policyEngine: PolicyEngine | null = null;
  private roleCtx: RoleContext = { role: "service_role" };
  private readonly dbPath: string;

  constructor(options: { dbPath?: string } = {}) {
    this.dbPath = options.dbPath ?? DEFAULT_DB_PATH;
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

    mkdirSync(dirname(this.dbPath), { recursive: true });

    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");

    this.createMetaTables();

    for (const table of schema.tables) {
      this.createTable(table);
    }
  }

  private rlsActive(table: string, schema: string): boolean {
    return (
      this.roleCtx.role !== "service_role" &&
      !!this.policyEngine &&
      this.policyEngine.isRlsEnabled(table, schema)
    );
  }

  private getDb(): BetterSqlite3Database {
    if (!this.db)
      throw new Error("SqliteAdapter not initialized. Call initialize() first.");
    return this.db;
  }

  private getTableIR(table: string, schema: string): TableIR | undefined {
    return this.schema?.tables.find((t) => t.name === table && t.schema === schema);
  }

  private createMetaTables(): void {
    const db = this.getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS _fakebase_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS _fakebase_auth_users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        encrypted_password TEXT,
        email_confirmed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        raw_user_meta_data TEXT
      );

      CREATE TABLE IF NOT EXISTS _fakebase_storage_buckets (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        public INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS _fakebase_storage_objects (
        id TEXT PRIMARY KEY,
        bucket_id TEXT NOT NULL REFERENCES _fakebase_storage_buckets(id),
        name TEXT NOT NULL,
        owner TEXT,
        size INTEGER,
        mime_type TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (bucket_id, name)
      );
    `);
  }

  private createTable(table: TableIR): void {
    const db = this.getDb();

    const columnDefs = table.columns.map((col) => {
      const type = mapColumnType(col.type);
      const parts: string[] = [`"${col.name}" ${type}`];
      if (col.primaryKey) parts.push("PRIMARY KEY");
      if (!col.nullable && !col.primaryKey) parts.push("NOT NULL");
      if (col.unique && !col.primaryKey) parts.push("UNIQUE");
      if (col.defaultSql) parts.push(`DEFAULT (${col.defaultSql})`);
      return parts.join(" ");
    });

    const createSql = [
      `CREATE TABLE IF NOT EXISTS "${table.schema}"."${table.name}" (`,
      columnDefs.join(",\n  "),
      `);`,
    ].join("\n  ");

    // SQLite doesn't support schema prefixes by default unless ATTACH'd.
    // For simplicity, use schema__table naming when schema != 'public'.
    const safeTable =
      table.schema === "public"
        ? `"${table.name}"`
        : `"${table.schema}__${table.name}"`;

    const simpleColumnDefs = table.columns.map((col) => {
      const type = mapColumnType(col.type);
      const parts: string[] = [`"${col.name}" ${type}`];
      if (col.primaryKey) parts.push("PRIMARY KEY");
      if (!col.nullable && !col.primaryKey) parts.push("NOT NULL");
      if (col.unique && !col.primaryKey) parts.push("UNIQUE");
      return parts.join(" ");
    });

    db.exec(
      `CREATE TABLE IF NOT EXISTS ${safeTable} (\n  ${simpleColumnDefs.join(",\n  ")}\n);`,
    );

    for (const idx of table.indexes) {
      const cols = idx.columns.map((c) => `"${c}"`).join(", ");
      const unique = idx.unique ? "UNIQUE " : "";
      db.exec(
        `CREATE ${unique}INDEX IF NOT EXISTS "${idx.name}" ON ${safeTable} (${cols});`,
      );
    }

    void createSql; // suppress unused variable warning
  }

  private tableRef(table: string, schema: string): string {
    return schema === "public" ? `"${table}"` : `"${schema}__${table}"`;
  }

  /**
   * Fill omitted columns with their schema default, mirroring how a real
   * database applies `DEFAULT` clauses. SQLite enforces `NOT NULL`, so without
   * this an omitted `created_at`/`id` (which rely on Postgres defaults like
   * `now()` / `gen_random_uuid()`) would violate the constraint and be dropped
   * by `INSERT OR IGNORE`. Only columns absent from the row are touched — an
   * explicit `null` is preserved.
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
    const db = this.getDb();
    const tableIR = this.getTableIR(table, schema);
    const ref = this.tableRef(table, schema);

    const results: AdapterRow[] = [];

    for (const row of rows) {
      const serialized = this.serializeRow(this.applyDefaults(row, tableIR), tableIR);
      const keys = Object.keys(serialized);
      const placeholders = keys.map(() => "?").join(", ");
      const columns = keys.map((k) => `"${k}"`).join(", ");
      const values = keys.map((k) => serialized[k]);

      db.prepare(
        `INSERT OR IGNORE INTO ${ref} (${columns}) VALUES (${placeholders})`,
      ).run(...(values as unknown[]));

      // Re-select the inserted row by primary key
      const pk = tableIR?.primaryKey ?? "id";
      const pkValue = serialized[pk];
      if (pkValue !== undefined && pkValue !== null) {
        const found = db
          .prepare(`SELECT * FROM ${ref} WHERE "${pk}" = ?`)
          .get(pkValue) as AdapterRow | undefined;
        if (found) {
          results.push(this.deserializeRow(found, tableIR));
        }
      } else {
        results.push(this.deserializeRow(serialized, tableIR));
      }
    }

    return results;
  }

  async select(
    table: string,
    schema: string,
    options: QueryOptions,
  ): Promise<QueryResult<AdapterRow>> {
    const db = this.getDb();
    const tableIR = this.getTableIR(table, schema);
    const ref = this.tableRef(table, schema);

    const { sql: sqlFilters, js: jsFilters } = splitFilters(options.filters);
    const { clause, params } = buildWhereClause(sqlFilters);

    // When RLS is active we must filter rows in JS *before* applying
    // limit/offset, so push pagination to the JS side in that case.
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

    let rows = db.prepare(sqlQuery).all(...(params as unknown[])) as AdapterRow[];

    // Deserialize all rows
    rows = rows.map((r) => this.deserializeRow(r, tableIR));

    // Apply JS-side filters (complex operators)
    if (jsFilters.length > 0) {
      rows = rows.filter((row) =>
        jsFilters.every((f) => applyFilter(row as Record<string, unknown>, f)),
      );
    }

    // RLS read filtering + JS-side pagination
    if (rls) {
      rows = rows.filter((row) =>
        this.policyEngine!.evaluateRead(table, schema, row, this.roleCtx),
      );
      const offset = options.offset ?? 0;
      const end = options.limit !== undefined ? offset + options.limit : undefined;
      rows = rows.slice(offset, end);
    }

    const totalBeforeProjection = rows.length;

    // Project columns
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
    const db = this.getDb();
    const tableIR = this.getTableIR(table, schema);
    const ref = this.tableRef(table, schema);

    const { sql: sqlFilters, js: jsFilters } = splitFilters(filters);
    const { clause, params: whereParams } = buildWhereClause(sqlFilters);

    // Fetch matching rows first
    let candidates = db
      .prepare(`SELECT * FROM ${ref} ${clause}`)
      .all(...(whereParams as unknown[])) as AdapterRow[];
    candidates = candidates.map((r) => this.deserializeRow(r, tableIR));

    if (jsFilters.length > 0) {
      candidates = candidates.filter((row) =>
        jsFilters.every((f) => applyFilter(row as Record<string, unknown>, f)),
      );
    }

    if (candidates.length === 0) return [];

    const serializedPatch = this.serializeRow(patch, tableIR);
    const patchKeys = Object.keys(serializedPatch);
    const setClause = patchKeys.map((k) => `"${k}" = ?`).join(", ");
    const patchValues = patchKeys.map((k) => serializedPatch[k]);

    const pk = tableIR?.primaryKey ?? "id";
    const updateStmt = db.prepare(`UPDATE ${ref} SET ${setClause} WHERE "${pk}" = ?`);

    const updated: AdapterRow[] = [];
    for (const row of candidates) {
      updateStmt.run(...(patchValues as unknown[]), row[pk]);
      const refreshed = db
        .prepare(`SELECT * FROM ${ref} WHERE "${pk}" = ?`)
        .get(row[pk]) as AdapterRow | undefined;
      if (refreshed) {
        updated.push(this.deserializeRow(refreshed, tableIR));
      }
    }

    return updated;
  }

  async upsert(
    table: string,
    schema: string,
    rows: AdapterRow[],
    onConflict?: string,
  ): Promise<AdapterRow[]> {
    const db = this.getDb();
    const tableIR = this.getTableIR(table, schema);
    const ref = this.tableRef(table, schema);
    const pk = tableIR?.primaryKey ?? "id";
    const conflictCol = onConflict ?? pk;

    const results: AdapterRow[] = [];

    for (const row of rows) {
      const serialized = this.serializeRow(this.applyDefaults(row, tableIR), tableIR);
      const keys = Object.keys(serialized);
      const columns = keys.map((k) => `"${k}"`).join(", ");
      const placeholders = keys.map(() => "?").join(", ");
      const values = keys.map((k) => serialized[k]);

      const updateSet = keys
        .filter((k) => k !== conflictCol)
        .map((k) => `"${k}" = excluded."${k}"`)
        .join(", ");

      const sql = updateSet
        ? `INSERT INTO ${ref} (${columns}) VALUES (${placeholders}) ON CONFLICT("${conflictCol}") DO UPDATE SET ${updateSet}`
        : `INSERT OR IGNORE INTO ${ref} (${columns}) VALUES (${placeholders})`;

      db.prepare(sql).run(...(values as unknown[]));

      const pkValue = serialized[pk];
      if (pkValue !== undefined && pkValue !== null) {
        const found = db
          .prepare(`SELECT * FROM ${ref} WHERE "${pk}" = ?`)
          .get(pkValue) as AdapterRow | undefined;
        if (found) {
          results.push(this.deserializeRow(found, tableIR));
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
    const db = this.getDb();
    const tableIR = this.getTableIR(table, schema);
    const ref = this.tableRef(table, schema);

    const { sql: sqlFilters, js: jsFilters } = splitFilters(filters);
    const { clause, params } = buildWhereClause(sqlFilters);

    let candidates = db
      .prepare(`SELECT * FROM ${ref} ${clause}`)
      .all(...(params as unknown[])) as AdapterRow[];
    candidates = candidates.map((r) => this.deserializeRow(r, tableIR));

    if (jsFilters.length > 0) {
      candidates = candidates.filter((row) =>
        jsFilters.every((f) => applyFilter(row as Record<string, unknown>, f)),
      );
    }

    if (candidates.length === 0) return [];

    const pk = tableIR?.primaryKey ?? "id";
    const deleteStmt = db.prepare(`DELETE FROM ${ref} WHERE "${pk}" = ?`);
    for (const row of candidates) {
      deleteStmt.run(row[pk]);
    }

    return candidates;
  }

  async rpc(_fn: string, _args: Record<string, unknown>): Promise<unknown> {
    throw CapabilityError.notImplemented("rpc");
  }

  exportData(): Record<string, AdapterRow[]> {
    const out: Record<string, AdapterRow[]> = {};
    const db = this.getDb();
    for (const table of this.schema?.tables ?? []) {
      const ref = this.tableRef(table.name, table.schema);
      const rows = db.prepare(`SELECT * FROM ${ref}`).all() as AdapterRow[];
      out[`${table.schema}.${table.name}`] = rows.map((r) =>
        this.deserializeRow(r, table),
      );
    }
    return out;
  }

  importData(data: Record<string, AdapterRow[]>): void {
    const db = this.getDb();
    for (const table of this.schema?.tables ?? []) {
      const key = `${table.schema}.${table.name}`;
      const rows = data[key];
      if (!rows) continue;
      const ref = this.tableRef(table.name, table.schema);
      db.prepare(`DELETE FROM ${ref}`).run();
      for (const row of rows) {
        const serialized = this.serializeRow(row, table);
        const keys = Object.keys(serialized);
        if (keys.length === 0) continue;
        const columns = keys.map((k) => `"${k}"`).join(", ");
        const placeholders = keys.map(() => "?").join(", ");
        db.prepare(
          `INSERT OR REPLACE INTO ${ref} (${columns}) VALUES (${placeholders})`,
        ).run(...(keys.map((k) => serialized[k]) as unknown[]));
      }
    }
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }
}

export interface CreateSqliteKernelOptions {
  dbPath?: string;
  schema?: ProjectSchemaIR;
  /** Directory for storage objects. Defaults to a temp dir next to the db. */
  storageDir?: string;
}

/**
 * Build a fully-wired SQLite-backed kernel (data + auth + storage + realtime +
 * functions). Synchronous, mirroring `createMemoryKernel`.
 */
export function createSqliteKernel<Database = unknown>(
  opts: CreateSqliteKernelOptions = {},
): FakebaseKernel<Database> {
  const adapter = new SqliteAdapter({ dbPath: opts.dbPath });
  const kernel = new FakebaseKernel<Database>({ adapter, schema: opts.schema });

  const auth = new LocalAuthService(
    new Map<string, AuthUser>(),
    new Map<string, OtpRecord>(),
    new MemorySessionStorage(),
  );
  const storage = new LocalStorageService(
    opts.storageDir ?? join(tmpdir(), "fakebase-sqlite-storage", randomUUID()),
    new Map<string, BucketRecord>(),
    new Map<string, ObjectRecord>(),
    new Map<string, SignedUrlRecord>(),
  );

  kernel.useAuth(auth).useStorage(storage);
  return kernel;
}
