import type { FakebaseAdapter, AdapterRow } from "@fakebase/core";
import type { QueryOptions, QueryResult } from "@fakebase/core";
import type { Filter } from "@fakebase/core";
import type { ProjectSchemaIR } from "@fakebase/core";
import type { RoleContext } from "@fakebase/core";
import { FakebaseKernel } from "@fakebase/core";
/**
 * In-memory adapter for Fakebase.
 *
 * Stores all rows in Maps keyed by the table's primary key value.
 * Supports optional RLS enforcement via the PolicyEngine when a non-service
 * role context is active.
 */
export declare class MemoryAdapter implements FakebaseAdapter {
    private readonly tables;
    private roleCtx;
    private registry;
    private policyEngine;
    /**
     * Switch the active role context.
     * Affects which rows are visible in subsequent `select` calls when RLS is
     * enabled on the queried table.
     */
    setRoleContext(ctx: RoleContext): void;
    getCurrentRole(): RoleContext;
    private key;
    initialize(schema: ProjectSchemaIR): void;
    private requireState;
    private applyDefaults;
    insert(table: string, schema: string, rows: AdapterRow[]): Promise<AdapterRow[]>;
    select(table: string, schema: string, options: QueryOptions): Promise<QueryResult<AdapterRow>>;
    update(table: string, schema: string, patch: AdapterRow, filters: Filter[]): Promise<AdapterRow[]>;
    upsert(table: string, schema: string, rows: AdapterRow[], onConflict?: string): Promise<AdapterRow[]>;
    delete(table: string, schema: string, filters: Filter[]): Promise<AdapterRow[]>;
    private readonly rpcHandlers;
    /**
     * Register an in-process RPC handler.
     * Useful for testing code that calls `rpc()`.
     */
    registerRpc(name: string, handler: (args: Record<string, unknown>) => unknown): void;
    rpc(fn: string, args: Record<string, unknown>): Promise<unknown>;
    /** Export the entire dataset keyed by `schema.table`. */
    exportData(): Record<string, AdapterRow[]>;
    /** Replace the entire dataset (used by snapshot restore). */
    importData(data: Record<string, AdapterRow[]>): void;
    close(): Promise<void>;
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
export declare function createMemoryKernel<Database = unknown>(schema?: ProjectSchemaIR): FakebaseKernel<Database>;
//# sourceMappingURL=memory-adapter.d.ts.map