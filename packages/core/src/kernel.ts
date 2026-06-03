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
import { CapabilityRegistry, CapabilityStatus } from "./capability.js";
import { EventBus } from "./events/bus.js";
import { FakebaseError } from "./errors.js";
import { PolicyEngine, type RoleContext } from "./policy/engine.js";
import type { ProjectSchemaIR, TableIR } from "./schema/ir.js";
import { SchemaRegistry } from "./schema/registry.js";
import type { FilterOperator, FilterNode, Filter } from "./query/filter.js";
import type {
  FilterItem,
  KernelQueryResult,
  PlanFilterOperator,
  QueryPlan,
} from "./query/plan.js";
import type { AuthEngine } from "./engines/auth.js";
import type { StorageEngine } from "./engines/storage.js";
import { InProcessRealtimeEngine, type RealtimeEngine } from "./engines/realtime.js";
import { LocalFunctionsRegistry, type FunctionsEngine } from "./engines/functions.js";
import { StubAuthEngine, StubStorageEngine } from "./engines/stubs.js";

/** Options for constructing a FakebaseKernel. */
export interface KernelOptions<_Database = unknown> {
  adapter: FakebaseAdapter;
  schema?: ProjectSchemaIR;
  capabilities?: CapabilityEntry[];
  auth?: AuthEngine;
  storage?: StorageEngine;
}

/** Minimal empty schema used when none is provided. */
const EMPTY_SCHEMA: ProjectSchemaIR = {
  tables: [],
  enums: [],
  functions: [],
  version: 0,
};

/** Maps the broad plan operator set onto the filter evaluator's operators. */
const OPERATOR_MAP: Record<string, FilterOperator> = {
  contained_by: "containedBy",
  containedBy: "containedBy",
  range_gt: "rangeGt",
  range_gte: "rangeGte",
  range_lt: "rangeLt",
  range_lte: "rangeLte",
  range_adjacent: "rangeAdjacent",
  fts: "match",
  plfts: "match",
  phfts: "match",
  wfts: "match",
};

function mapOperator(op: PlanFilterOperator): FilterOperator {
  return (OPERATOR_MAP[op] ?? op) as FilterOperator;
}

/**
 * The central Fakebase kernel.
 *
 * @typeParam Database - Optional generated database type (used by the client).
 */
export class FakebaseKernel<_Database = unknown> {
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

  private readonly adapter: FakebaseAdapter;
  private schemaIR: ProjectSchemaIR;
  private currentRole: RoleContext = { role: "service_role" };

  constructor(options: KernelOptions<_Database>) {
    this.adapter = options.adapter;
    this.schemaIR = options.schema ?? EMPTY_SCHEMA;
    this.schema = new SchemaRegistry(this.schemaIR);
    this.capabilities = new CapabilityRegistry();
    this.bus = new EventBus();
    this.policy = new PolicyEngine(this.schema);
    this.realtime = new InProcessRealtimeEngine(this.bus);
    this.functions = new LocalFunctionsRegistry();
    this.auth = options.auth ?? new StubAuthEngine();
    this.storage = options.storage ?? new StubStorageEngine();

    this.registerDefaultCapabilities();
    for (const cap of options.capabilities ?? []) {
      this.capabilities.register(cap);
    }

    this.adapter.initialize(this.schemaIR);
  }

  private registerDefaultCapabilities(): void {
    const supported = (name: string, notes?: string): void =>
      this.capabilities.register({ name, status: CapabilityStatus.SUPPORTED, notes });
    const partial = (name: string, notes: string): void =>
      this.capabilities.register({ name, status: CapabilityStatus.PARTIAL, notes });

    supported(
      "database.crud",
      "insert/select/update/upsert/delete with filters, order, range",
    );
    supported("database.rpc", "Local function registry");
    supported("auth.password", "signUp / signInWithPassword / sessions");
    supported("auth.otp", "signInWithOtp / verifyOtp via local inbox");
    supported("storage.objects", "buckets, upload/download, public + signed URLs");
    supported("realtime.postgres_changes", "Emitted from the mutation commit pipeline");
    supported("realtime.broadcast", "In-process channel broadcast");
    partial(
      "rls",
      "Simplified policy evaluation; verify against real Postgres before production",
    );
    partial("realtime.presence", "In-process presence; not durable across processes");
  }

  // ---------------------------------------------------------------------------
  // Engine wiring
  // ---------------------------------------------------------------------------

  /** Attach a real auth engine (e.g. `LocalAuthService`). */
  useAuth(auth: AuthEngine): this {
    this.auth = auth;
    return this;
  }

  /** Attach a real storage engine (e.g. `LocalStorageService`). */
  useStorage(storage: StorageEngine): this {
    this.storage = storage;
    return this;
  }

  /** Replace the realtime engine. */
  useRealtime(realtime: RealtimeEngine): this {
    this.realtime = realtime;
    return this;
  }

  // ---------------------------------------------------------------------------
  // Role / RLS context
  // ---------------------------------------------------------------------------

  /** Set the active role context used for RLS evaluation. */
  setRole(ctx: RoleContext): this {
    this.currentRole = ctx;
    this.applyRole();
    return this;
  }

  /** Return the active role context. */
  getRole(): RoleContext {
    return this.currentRole;
  }

  private applyRole(): void {
    this.adapter.setRoleContext?.(this.currentRole);
  }

  private rlsActive(table: string, schema: string): boolean {
    return (
      this.currentRole.role !== "service_role" &&
      this.policy.isRlsEnabled(table, schema)
    );
  }

  // ---------------------------------------------------------------------------
  // Query orchestration
  // ---------------------------------------------------------------------------

  /** Execute a fully-described query plan. */
  async query(plan: QueryPlan): Promise<KernelQueryResult> {
    // Validate the target table exists (throws FakebaseError.tableMissing).
    this.schema.requireTable(plan.schema, plan.table);
    this.applyRole();

    const filters = plan.filters.map((f) => this.toCoreFilter(f));

    switch (plan.operation) {
      case "select": {
        const res = await this.adapter.select(plan.table, plan.schema, {
          table: plan.table,
          schema: plan.schema,
          select: plan.select,
          filters,
          orderBy: plan.orderBy,
          limit: plan.limit,
          offset: plan.offset,
          count: plan.count,
        });
        if (res.error) throw res.error;
        return { rows: res.data ?? [], count: res.count ?? undefined };
      }

      case "insert": {
        const rows = plan.insertData ?? [];
        this.checkWrite(plan.table, plan.schema, rows, "INSERT");
        const inserted = await this.adapter.insert(plan.table, plan.schema, rows);
        this.emit("INSERT", plan.schema, plan.table, inserted);
        return this.shapeReturning(inserted, plan);
      }

      case "update": {
        const updated = await this.runUpdate(plan, filters);
        this.emit("UPDATE", plan.schema, plan.table, updated);
        return this.shapeReturning(updated, plan);
      }

      case "upsert": {
        const rows = plan.upsertData ?? [];
        this.checkWrite(plan.table, plan.schema, rows, "INSERT");
        const result = await this.adapter.upsert(
          plan.table,
          plan.schema,
          rows,
          plan.onConflict,
        );
        this.emit("INSERT", plan.schema, plan.table, result);
        return this.shapeReturning(result, plan);
      }

      case "delete": {
        const deleted = await this.runDelete(plan, filters);
        this.emit("DELETE", plan.schema, plan.table, deleted);
        return this.shapeReturning(deleted, plan);
      }

      default: {
        const _exhaustive: never = plan.operation;
        throw new Error(`Unsupported operation: ${String(_exhaustive)}`);
      }
    }
  }

  /** Convenience RPC entry point used by the client `rpc()`. */
  rpc(
    fn: string,
    args: Record<string, unknown> = {},
    opts?: { head?: boolean; count?: "exact" | "planned" | "estimated" },
  ): ReturnType<FunctionsEngine["callRpc"]> {
    return this.functions.callRpc(fn, args, opts);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private toCoreFilter(item: FilterItem): Filter {
    if (item.type === "or") {
      return { type: "or", filters: item.filters.map((f) => this.toCoreFilter(f)) };
    }
    if (item.type === "and") {
      return { type: "and", filters: item.filters.map((f) => this.toCoreFilter(f)) };
    }
    const node: FilterNode = {
      column: item.column,
      operator: mapOperator(item.operator),
      value: item.value,
    };
    return item.negate ? { type: "not", filter: node } : node;
  }

  private checkWrite(
    table: string,
    schema: string,
    rows: AdapterRow[],
    op: "INSERT" | "UPDATE",
  ): void {
    if (!this.rlsActive(table, schema)) return;
    for (const row of rows) {
      if (!this.policy.evaluateWrite(table, schema, row, this.currentRole, op)) {
        throw FakebaseError.policyDenied(table, op.toLowerCase());
      }
    }
  }

  private async runUpdate(plan: QueryPlan, filters: Filter[]): Promise<AdapterRow[]> {
    const patch = plan.updateData ?? {};
    if (!this.rlsActive(plan.table, plan.schema)) {
      return this.adapter.update(plan.table, plan.schema, patch, filters);
    }

    const targets = await this.scanAsService(plan.table, plan.schema, filters);
    const allowed = targets.filter((r) =>
      this.policy.evaluateWrite(plan.table, plan.schema, r, this.currentRole, "UPDATE"),
    );
    // WITH CHECK on the post-image of each row.
    for (const row of allowed) {
      const post = { ...row, ...patch };
      if (
        !this.policy.evaluateWrite(
          plan.table,
          plan.schema,
          post,
          this.currentRole,
          "UPDATE",
        )
      ) {
        throw FakebaseError.policyDenied(plan.table, "update");
      }
    }
    if (allowed.length === 0) return [];
    return this.adapter.update(plan.table, plan.schema, patch, [
      this.pkFilter(plan, allowed),
    ]);
  }

  private async runDelete(plan: QueryPlan, filters: Filter[]): Promise<AdapterRow[]> {
    if (!this.rlsActive(plan.table, plan.schema)) {
      return this.adapter.delete(plan.table, plan.schema, filters);
    }
    const targets = await this.scanAsService(plan.table, plan.schema, filters);
    const allowed = targets.filter((r) =>
      this.policy.evaluateWrite(plan.table, plan.schema, r, this.currentRole, "DELETE"),
    );
    if (allowed.length === 0) return [];
    return this.adapter.delete(plan.table, plan.schema, [this.pkFilter(plan, allowed)]);
  }

  /** Read all rows matching `filters` ignoring RLS (service-role view). */
  private async scanAsService(
    table: string,
    schema: string,
    filters: Filter[],
  ): Promise<AdapterRow[]> {
    this.adapter.setRoleContext?.({ role: "service_role" });
    const res = await this.adapter.select(table, schema, { table, schema, filters });
    this.applyRole();
    if (res.error) throw res.error;
    return res.data ?? [];
  }

  private pkFilter(plan: QueryPlan, rows: AdapterRow[]): Filter {
    const pk = this.schema.requireTable(plan.schema, plan.table).primaryKey;
    return { column: pk, operator: "in", value: rows.map((r) => r[pk]) };
  }

  private emit(
    type: "INSERT" | "UPDATE" | "DELETE",
    schema: string,
    table: string,
    rows: AdapterRow[],
  ): void {
    const commitTimestamp = new Date().toISOString();
    for (const record of rows) {
      this.bus.publish({ type, schema, table, record, commitTimestamp });
    }
  }

  private shapeReturning(rows: AdapterRow[], plan: QueryPlan): KernelQueryResult {
    if (plan.select && plan.select.length > 0) {
      const cols = plan.select;
      return {
        rows: rows.map((r) => {
          const out: AdapterRow = {};
          for (const c of cols) out[c] = r[c];
          return out;
        }),
      };
    }
    return { rows };
  }

  // ---------------------------------------------------------------------------
  // Schema management & lifecycle
  // ---------------------------------------------------------------------------

  /** Add a table at runtime (e.g. after a migration) and re-init the adapter. */
  addTable(table: TableIR): void {
    this.schema.addTable(table);
    this.schemaIR = this.schema.toIR();
    this.adapter.initialize(this.schemaIR);
  }

  /** Export the full dataset (for snapshots). */
  snapshot(): Record<string, AdapterRow[]> {
    return this.adapter.exportData?.() ?? {};
  }

  /** Restore a previously exported dataset. */
  restore(data: Record<string, AdapterRow[]>): void {
    this.adapter.importData?.(data);
  }

  /** Flush buffered writes to durable storage (no-op for memory). */
  async flush(): Promise<void> {
    await this.adapter.flush?.();
  }

  /** Tear down the kernel and flush any pending writes. */
  async close(): Promise<void> {
    await this.adapter.close();
    this.bus.clear();
  }
}
