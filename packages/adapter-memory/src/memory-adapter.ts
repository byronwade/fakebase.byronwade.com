import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { FakebaseAdapter, AdapterRow, AdapterTableState } from "@byronwade/core";
import type { QueryOptions, QueryResult } from "@byronwade/core";
import type { Filter } from "@byronwade/core";
import type { ProjectSchemaIR, TableIR } from "@byronwade/core";
import type { RoleContext } from "@byronwade/core";
import {
  compileQuery,
  applyFilter,
  FakebaseError,
  FakebaseErrorCode,
  FakebaseKernel,
  PolicyEngine,
  SchemaRegistry,
} from "@byronwade/core";
import { LocalAuthService, MemorySessionStorage } from "@byronwade/auth";
import { LocalStorageService } from "@byronwade/storage";
import type { AuthUser, OtpRecord, BucketRecord, ObjectRecord } from "@byronwade/core";
import type { SignedUrlRecord } from "@byronwade/storage";

/**
 * In-memory adapter for Fakebase.
 *
 * Stores all rows in Maps keyed by the table's primary key value.
 * Supports optional RLS enforcement via the PolicyEngine when a non-service
 * role context is active.
 */
export class MemoryAdapter implements FakebaseAdapter {
  private readonly tables = new Map<string, AdapterTableState>();
  private roleCtx: RoleContext = { role: "service_role" };
  private registry: SchemaRegistry | null = null;
  private policyEngine: PolicyEngine | null = null;

  /**
   * Switch the active role context.
   * Affects which rows are visible in subsequent `select` calls when RLS is
   * enabled on the queried table.
   */
  setRoleContext(ctx: RoleContext): void {
    this.roleCtx = ctx;
  }

  getCurrentRole(): RoleContext {
    return this.roleCtx;
  }

  private key(schema: string, table: string): string {
    return `${schema}.${table}`;
  }

  initialize(schema: ProjectSchemaIR): void {
    this.registry = new SchemaRegistry(schema);
    this.policyEngine = new PolicyEngine(this.registry);

    for (const table of schema.tables) {
      const k = this.key(table.schema, table.name);
      if (!this.tables.has(k)) {
        this.tables.set(k, { rows: new Map(), schema: table });
      }
    }
  }

  private requireState(schema: string, table: string): AdapterTableState {
    const state = this.tables.get(this.key(schema, table));
    if (!state) throw FakebaseError.tableMissing(`${schema}.${table}`);
    return state;
  }

  private applyDefaults(row: AdapterRow, tableSchema: TableIR): AdapterRow {
    const out: AdapterRow = { ...row };

    for (const col of tableSchema.columns) {
      if (out[col.name] !== undefined) continue;

      if (
        col.defaultSql === "gen_random_uuid()" ||
        (col.primaryKey && col.type === "uuid" && col.defaultSql === undefined)
      ) {
        out[col.name] = crypto.randomUUID();
      } else if (col.defaultSql === "now()") {
        out[col.name] = new Date().toISOString();
      } else if (col.defaultSql !== undefined) {
        const lit = col.defaultSql.match(/^'(.*)'(?:::[a-z ]+)?$/s);
        if (lit) {
          out[col.name] = lit[1];
        } else if (col.defaultSql === "false") {
          out[col.name] = false;
        } else if (col.defaultSql === "true") {
          out[col.name] = true;
        } else if (col.defaultSql !== "" && !isNaN(Number(col.defaultSql))) {
          out[col.name] = Number(col.defaultSql);
        } else {
          out[col.name] = col.defaultSql;
        }
      }
    }

    return out;
  }

  async insert(
    table: string,
    schema: string,
    rows: AdapterRow[],
  ): Promise<AdapterRow[]> {
    const state = this.requireState(schema, table);
    const inserted: AdapterRow[] = [];

    for (const row of rows) {
      const r = this.applyDefaults(row, state.schema);

      for (const col of state.schema.columns) {
        if ((col.unique ?? col.primaryKey) && r[col.name] != null) {
          for (const [, existing] of state.rows) {
            if (existing[col.name] === r[col.name]) {
              throw FakebaseError.uniqueViolation(table, col.name);
            }
          }
        }
      }

      const pkVal = r[state.schema.primaryKey];
      state.rows.set(String(pkVal), { ...r });
      inserted.push({ ...r });
    }

    return inserted;
  }

  async select(
    table: string,
    schema: string,
    options: QueryOptions,
  ): Promise<QueryResult<AdapterRow>> {
    const state = this.requireState(schema, table);
    let rows = [...state.rows.values()];

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
    const state = this.requireState(schema, table);
    const updated: AdapterRow[] = [];

    for (const [key, row] of state.rows) {
      const passes = filters.length === 0 || filters.every((f) => applyFilter(row, f));
      if (passes) {
        const updatedRow = { ...row, ...patch };
        state.rows.set(key, updatedRow);
        updated.push({ ...updatedRow });
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
    const state = this.requireState(schema, table);
    const conflictCol = onConflict ?? state.schema.primaryKey;
    const result: AdapterRow[] = [];

    for (const row of rows) {
      const r = this.applyDefaults(row, state.schema);
      const conflictVal = r[conflictCol];

      let existingKey: string | undefined;
      for (const [key, existing] of state.rows) {
        if (existing[conflictCol] === conflictVal) {
          existingKey = key;
          break;
        }
      }

      if (existingKey !== undefined) {
        const merged = { ...state.rows.get(existingKey)!, ...row };
        state.rows.set(existingKey, merged);
        result.push({ ...merged });
      } else {
        const pkVal = r[state.schema.primaryKey];
        state.rows.set(String(pkVal), { ...r });
        result.push({ ...r });
      }
    }

    return result;
  }

  async delete(
    table: string,
    schema: string,
    filters: Filter[],
  ): Promise<AdapterRow[]> {
    const state = this.requireState(schema, table);
    const deleted: AdapterRow[] = [];

    for (const [key, row] of state.rows) {
      const passes = filters.length === 0 || filters.every((f) => applyFilter(row, f));
      if (passes) {
        deleted.push({ ...row });
        state.rows.delete(key);
      }
    }

    return deleted;
  }

  private readonly rpcHandlers = new Map<
    string,
    (args: Record<string, unknown>) => unknown
  >();

  /**
   * Register an in-process RPC handler.
   * Useful for testing code that calls `rpc()`.
   */
  registerRpc(name: string, handler: (args: Record<string, unknown>) => unknown): void {
    this.rpcHandlers.set(name, handler);
  }

  async rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
    const handler = this.rpcHandlers.get(fn);
    if (!handler) {
      throw new FakebaseError(
        FakebaseErrorCode.FUNCTION_ERROR,
        `Function '${fn}' is not registered in MemoryAdapter.`,
      );
    }
    return handler(args);
  }

  /** Export the entire dataset keyed by `schema.table`. */
  exportData(): Record<string, AdapterRow[]> {
    const out: Record<string, AdapterRow[]> = {};
    for (const [key, state] of this.tables) {
      out[key] = [...state.rows.values()].map((r) => ({ ...r }));
    }
    return out;
  }

  /** Replace the entire dataset (used by snapshot restore). */
  importData(data: Record<string, AdapterRow[]>): void {
    for (const [key, rows] of Object.entries(data)) {
      const state = this.tables.get(key);
      if (!state) continue;
      state.rows.clear();
      const pk = state.schema.primaryKey;
      for (const row of rows) {
        state.rows.set(String(row[pk]), { ...row });
      }
    }
  }

  async close(): Promise<void> {
    this.tables.clear();
    this.registry = null;
    this.policyEngine = null;
  }
}

/**
 * Convenience factory: build a fully-wired in-memory kernel (data + auth +
 * storage + realtime + functions) in a single synchronous call.
 *
 * ```ts
 * const kernel = createMemoryKernel(mySchema);
 * const { rows } = await kernel.query({ schema: "public", table: "users", operation: "select", filters: [], orderBy: [] });
 * ```
 *
 * @param schema  Optional project schema IR. Defaults to an empty schema.
 */
export function createMemoryKernel<Database = unknown>(
  schema?: ProjectSchemaIR,
): FakebaseKernel<Database> {
  const adapter = new MemoryAdapter();
  const kernel = new FakebaseKernel<Database>({ adapter, schema });

  const auth = new LocalAuthService(
    new Map<string, AuthUser>(),
    new Map<string, OtpRecord>(),
    new MemorySessionStorage(),
  );
  const storage = new LocalStorageService(
    join(tmpdir(), "fakebase-storage", randomUUID()),
    new Map<string, BucketRecord>(),
    new Map<string, ObjectRecord>(),
    new Map<string, SignedUrlRecord>(),
  );

  kernel.useAuth(auth).useStorage(storage);
  return kernel;
}
