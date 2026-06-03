/**
 * FakebaseKernel — the compatibility kernel that wires together every
 * sub-system: schema registry, query orchestration, RLS policy enforcement,
 * the event bus, and the auth / storage / realtime / functions engines.
 *
 * The kernel is the single execution point used by the client query builder:
 * the builder produces a {@link QueryPlan} and calls `kernel.query(plan)`.
 *
 * ```ts
 * const kernel = createMemoryKernel(schema);
 * const { rows } = await kernel.query({
 *   schema: "public", table: "users", operation: "select",
 *   filters: [{ type: "simple", column: "active", operator: "eq", value: true }],
 *   orderBy: [],
 * });
 * ```
 */
import type { AdapterRow, FakebaseAdapter } from "./adapter.js";
import type { CapabilityEntry } from "./capability.js";
import { CapabilityRegistry } from "./capability.js";
import { EventBus } from "./events/bus.js";
import { PolicyEngine, type RoleContext } from "./policy/engine.js";
import type { ProjectSchemaIR, TableIR } from "./schema/ir.js";
import { SchemaRegistry } from "./schema/registry.js";
import type { KernelQueryResult, QueryPlan } from "./query/plan.js";
import type { AuthEngine } from "./engines/auth.js";
import type { StorageEngine } from "./engines/storage.js";
import { type RealtimeEngine } from "./engines/realtime.js";
import { type FunctionsEngine } from "./engines/functions.js";
/** Options for constructing a FakebaseKernel. */
export interface KernelOptions<_Database = unknown> {
    adapter: FakebaseAdapter;
    schema?: ProjectSchemaIR;
    capabilities?: CapabilityEntry[];
    auth?: AuthEngine;
    storage?: StorageEngine;
}
/**
 * The central Fakebase kernel.
 *
 * @typeParam Database - Optional generated database type (used by the client).
 */
export declare class FakebaseKernel<_Database = unknown> {
    readonly capabilities: CapabilityRegistry;
    readonly schema: SchemaRegistry;
    readonly bus: EventBus;
    readonly policy: PolicyEngine;
    /** Auth engine — defaults to a stub until `useAuth()` is called. */
    auth: AuthEngine;
    /** Storage engine — defaults to a stub until `useStorage()` is called. */
    storage: StorageEngine;
    /** Realtime engine — in-process pub/sub backed by the event bus. */
    realtime: RealtimeEngine;
    /** Functions engine — local registry for RPC and edge-style invocation. */
    readonly functions: FunctionsEngine;
    private readonly adapter;
    private schemaIR;
    private currentRole;
    constructor(options: KernelOptions<_Database>);
    private registerDefaultCapabilities;
    /** Attach a real auth engine (e.g. `LocalAuthService`). */
    useAuth(auth: AuthEngine): this;
    /** Attach a real storage engine (e.g. `LocalStorageService`). */
    useStorage(storage: StorageEngine): this;
    /** Replace the realtime engine. */
    useRealtime(realtime: RealtimeEngine): this;
    /** Set the active role context used for RLS evaluation. */
    setRole(ctx: RoleContext): this;
    /** Return the active role context. */
    getRole(): RoleContext;
    private applyRole;
    private rlsActive;
    /** Execute a fully-described query plan. */
    query(plan: QueryPlan): Promise<KernelQueryResult>;
    /** Convenience RPC entry point used by the client `rpc()`. */
    rpc(fn: string, args?: Record<string, unknown>, opts?: {
        head?: boolean;
        count?: "exact" | "planned" | "estimated";
    }): ReturnType<FunctionsEngine["callRpc"]>;
    private toCoreFilter;
    private checkWrite;
    private runUpdate;
    private runDelete;
    /** Read all rows matching `filters` ignoring RLS (service-role view). */
    private scanAsService;
    private pkFilter;
    private emit;
    private shapeReturning;
    /** Add a table at runtime (e.g. after a migration) and re-init the adapter. */
    addTable(table: TableIR): void;
    /** Export the full dataset (for snapshots). */
    snapshot(): Record<string, AdapterRow[]>;
    /** Restore a previously exported dataset. */
    restore(data: Record<string, AdapterRow[]>): void;
    /** Flush buffered writes to durable storage (no-op for memory). */
    flush(): Promise<void>;
    /** Tear down the kernel and flush any pending writes. */
    close(): Promise<void>;
}
//# sourceMappingURL=kernel.d.ts.map