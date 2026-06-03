/**
 * Adapter interface — the contract that every storage backend must fulfil.
 *
 * The kernel owns all higher-level semantics (defaults, RLS write checks,
 * event emission, plan translation). An adapter is responsible only for
 * persisting rows and answering the granular CRUD operations below.
 *
 * Read/mutation operations are async so that adapters backed by network or
 * file I/O can participate; `initialize` is synchronous so that a fully-usable
 * kernel can be created without `await` (see `createMemoryKernel`).
 */
import type { QueryOptions, QueryResult } from "./query/compiler.js";
import type { Filter } from "./query/filter.js";
import type { ProjectSchemaIR } from "./schema/ir.js";
import type { RoleContext } from "./policy/engine.js";
/** A single untyped row value. */
export type AdapterRow = Record<string, unknown>;
/** The internal per-table storage held by a stateful adapter. */
export interface AdapterTableState {
    rows: Map<string, AdapterRow>;
    schema: import("./schema/ir.js").TableIR;
}
/**
 * The FakebaseAdapter contract.
 *
 * Implementors handle all data persistence and must translate their internal
 * storage representation into the `QueryResult` envelope on every read.
 */
export interface FakebaseAdapter {
    /** Load schema and seed initial state. Synchronous so kernels init eagerly. */
    initialize(schema: ProjectSchemaIR): void;
    /** Insert one or more rows and return them as stored (with generated defaults applied). */
    insert(table: string, schema: string, rows: AdapterRow[]): Promise<AdapterRow[]>;
    /** Execute a query and return the Supabase-shaped result envelope. */
    select(table: string, schema: string, options: QueryOptions): Promise<QueryResult<AdapterRow>>;
    /** Apply a partial update to all rows matching the filters; return updated rows. */
    update(table: string, schema: string, patch: AdapterRow, filters: Filter[]): Promise<AdapterRow[]>;
    /**
     * Insert or update rows based on the primary key or an explicit conflict column.
     * Returns the final state of every row (inserted or updated).
     */
    upsert(table: string, schema: string, rows: AdapterRow[], onConflict?: string): Promise<AdapterRow[]>;
    /** Delete all rows matching the filters; return the deleted rows. */
    delete(table: string, schema: string, filters: Filter[]): Promise<AdapterRow[]>;
    /** Invoke a registered database function (RPC). */
    rpc(fn: string, args: Record<string, unknown>): Promise<unknown>;
    /**
     * Switch the active RLS role context. Optional — adapters that do not enforce
     * RLS internally can omit this and the kernel will fall back to its own
     * policy evaluation.
     */
    setRoleContext?(ctx: RoleContext): void;
    /** Export the full dataset as a plain object keyed by `schema.table`. */
    exportData?(): Record<string, AdapterRow[]>;
    /** Replace the full dataset (used by snapshot restore). */
    importData?(data: Record<string, AdapterRow[]>): void;
    /** Flush any buffered writes to durable storage. */
    flush?(): Promise<void>;
    /** Tear down the adapter (flush buffers, close connections). */
    close(): Promise<void>;
}
//# sourceMappingURL=adapter.d.ts.map