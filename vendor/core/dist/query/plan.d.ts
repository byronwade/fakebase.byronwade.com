/**
 * The high-level query plan produced by the client query builder and consumed
 * by `FakebaseKernel.query()`.
 *
 * This is intentionally distinct from the low-level adapter `QueryOptions`:
 * the plan models the *intent* of a Supabase-style fluent query (including
 * mutations and `negate`d filters), while the kernel translates it into the
 * concrete adapter operations and the {@link FilterNode} tree understood by
 * the query compiler.
 */
/**
 * The full PostgREST-style operator set understood by the client builder.
 * The kernel maps these onto the lower-level {@link FilterOperator} used by the
 * filter evaluator (e.g. `contained_by` → `containedBy`).
 */
export type PlanFilterOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "is" | "in" | "contains" | "contained_by" | "containedBy" | "overlaps" | "match" | "fts" | "plfts" | "phfts" | "wfts" | "range_gt" | "range_gte" | "range_lt" | "range_lte" | "range_adjacent" | (string & {});
/** A single column predicate. `negate` wraps the predicate in a logical NOT. */
export interface SimpleFilter {
    type: "simple";
    column: string;
    operator: PlanFilterOperator;
    value: unknown;
    negate?: boolean;
}
/** A disjunction (`.or(...)`) of plan filters. */
export interface OrFilter {
    type: "or";
    filters: FilterItem[];
}
/** A conjunction (`and(...)` inside a PostgREST filter string) of plan filters. */
export interface AndFilter {
    type: "and";
    filters: FilterItem[];
}
/** Any node in a plan filter tree. */
export type FilterItem = SimpleFilter | OrFilter | AndFilter;
/** A single ordering directive. */
export interface OrderItem {
    column: string;
    ascending: boolean;
    nullsFirst?: boolean;
    /** Reserved for embedded-resource ordering; recorded but not yet applied. */
    referencedTable?: string;
}
/** The five DML operations a plan can describe. */
export type PlanOperation = "select" | "insert" | "update" | "upsert" | "delete";
/**
 * A fully-described query, ready for the kernel to execute.
 * Produced by the client `DatabaseBuilder`.
 */
export interface QueryPlan {
    schema: string;
    table: string;
    operation: PlanOperation;
    filters: FilterItem[];
    /** Projected columns; `undefined` means all columns. */
    select?: string[];
    orderBy: OrderItem[];
    limit?: number;
    offset?: number;
    insertData?: Record<string, unknown>[];
    updateData?: Record<string, unknown>;
    upsertData?: Record<string, unknown>[];
    onConflict?: string;
    ignoreDuplicates?: boolean;
    /** True when a mutation should return the affected rows (i.e. `.select()` chained). */
    returning?: boolean;
    count?: "exact" | "planned" | "estimated";
}
/** The result envelope returned by `FakebaseKernel.query()`. */
export interface KernelQueryResult {
    rows: Record<string, unknown>[];
    /** Total matching rows before pagination, when a count was requested. */
    count?: number;
}
//# sourceMappingURL=plan.d.ts.map