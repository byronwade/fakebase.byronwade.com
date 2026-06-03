/**
 * Supabase-compatible query builder for Fakebase.
 *
 * Mirrors the @supabase/supabase-js query builder API:
 * - Chainable filter methods (.eq, .neq, .gt, …)
 * - Operation methods (.select, .insert, .update, .delete, .upsert)
 * - Modifiers (.single, .maybeSingle, .order, .limit, .range)
 * - Thenable — await the builder to execute the query.
 */
import type { FakebaseAdapter } from "@fakebase/core";
import type { FilterOperator } from "@fakebase/core";
export type SupabaseResult<T> = {
    data: T | null;
    error: {
        message: string;
        code?: string;
        details?: string;
        hint?: string;
    } | null;
    count: number | null;
    status: number;
    statusText: string;
};
/**
 * Chainable query builder. All filter/modifier methods return `this`.
 * Awaiting the builder (or calling `.then()`) executes the accumulated query.
 */
export declare class QueryBuilder<Row extends Record<string, unknown> = Record<string, unknown>> implements PromiseLike<SupabaseResult<Row[]>> {
    private readonly _table;
    private readonly _schema;
    private readonly _adapterPromise;
    private _mode;
    private _columns;
    private _filters;
    private _orderBy;
    private _limit;
    private _offset;
    private _single;
    private _maybeSingle;
    private _returning;
    private _countMode;
    private _insertData;
    private _updateData;
    private _upsertData;
    private _onConflict;
    constructor(table: string, schema: string, adapterPromise: Promise<FakebaseAdapter>);
    /** Set mode to SELECT. Optionally specify columns. */
    select(columns?: string): this;
    /** Set mode to INSERT. */
    insert(data: Row | Row[]): this;
    /** Set mode to UPDATE. */
    update(data: Partial<Row>): this;
    /** Set mode to DELETE. */
    delete(): this;
    /** Set mode to UPSERT. */
    upsert(data: Row | Row[], options?: {
        onConflict?: string;
        ignoreDuplicates?: boolean;
    }): this;
    private _addFilter;
    eq(column: string, value: unknown): this;
    neq(column: string, value: unknown): this;
    gt(column: string, value: unknown): this;
    gte(column: string, value: unknown): this;
    lt(column: string, value: unknown): this;
    lte(column: string, value: unknown): this;
    like(column: string, pattern: string): this;
    ilike(column: string, pattern: string): this;
    is(column: string, value: boolean | null): this;
    in(column: string, values: unknown[]): this;
    contains(column: string, value: unknown): this;
    containedBy(column: string, value: unknown): this;
    overlaps(column: string, value: unknown): this;
    textSearch(column: string, query: string): this;
    match(query: Record<string, unknown>): this;
    not(column: string, operator: FilterOperator, value: unknown): this;
    or(filters: string, options?: {
        foreignTable?: string;
    }): this;
    filter(column: string, operator: FilterOperator, value: unknown): this;
    order(column: string, options?: {
        ascending?: boolean;
        nullsFirst?: boolean;
        referencedTable?: string;
    }): this;
    limit(count: number, options?: {
        referencedTable?: string;
    }): this;
    range(from: number, to: number, options?: {
        referencedTable?: string;
    }): this;
    /** Expect exactly one row. Errors if zero or more than one row. */
    single(): QueryBuilder<Row> & PromiseLike<SupabaseResult<Row>>;
    /** Return one row or null. Errors if more than one row. */
    maybeSingle(): QueryBuilder<Row> & PromiseLike<SupabaseResult<Row | null>>;
    /** Request row count alongside the query. */
    count(countMode?: "exact" | "planned" | "estimated"): this;
    then<TResult1 = SupabaseResult<Row[]>, TResult2 = never>(onfulfilled?: ((value: SupabaseResult<Row[]>) => TResult1 | PromiseLike<TResult1>) | null | undefined, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined): Promise<TResult1 | TResult2>;
    private _execute;
    private _execSelect;
    private _execInsert;
    private _execUpdate;
    private _execDelete;
    private _execUpsert;
}
//# sourceMappingURL=query-builder.d.ts.map