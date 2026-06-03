/**
 * DatabaseBuilder — lazy, fluent query builder that mirrors the
 * `@supabase/supabase-js` PostgREST client API.
 *
 * The builder accumulates state synchronously and executes lazily when
 * awaited (via the `.then()` thenable hook) or when `.csv()` is called.
 */
import { FakebaseError } from "@fakebase/core";
import type { FakebaseKernel } from "@fakebase/core";
type GenericSchema = {
    Tables: Record<string, {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
    }>;
    Views: Record<string, {
        Row: Record<string, unknown>;
    }>;
};
type GenericDatabase = Record<string, GenericSchema>;
type ExtractRow<Database, TableName extends string, SchemaName extends string = "public"> = Database extends GenericDatabase ? SchemaName extends keyof Database ? TableName extends keyof Database[SchemaName]["Tables"] ? Database[SchemaName]["Tables"][TableName]["Row"] : Record<string, unknown> : Record<string, unknown> : Record<string, unknown>;
type ExtractInsert<Database, TableName extends string, SchemaName extends string = "public"> = Database extends GenericDatabase ? SchemaName extends keyof Database ? TableName extends keyof Database[SchemaName]["Tables"] ? Database[SchemaName]["Tables"][TableName]["Insert"] : Record<string, unknown> : Record<string, unknown> : Record<string, unknown>;
type ExtractUpdate<Database, TableName extends string, SchemaName extends string = "public"> = Database extends GenericDatabase ? SchemaName extends keyof Database ? TableName extends keyof Database[SchemaName]["Tables"] ? Database[SchemaName]["Tables"][TableName]["Update"] : Record<string, unknown> : Record<string, unknown> : Record<string, unknown>;
/** Shape returned by every awaited builder call. */
export interface FakebaseResponse<T> {
    data: T | null;
    error: FakebaseError | null;
    count: number | null;
    status: number;
    statusText: string;
}
/**
 * Fluent query builder for a single table.
 *
 * Designed to be a drop-in replacement for the Supabase PostgREST builder.
 * The builder is lazy — it only executes when you `await` it or call `.csv()`.
 *
 * @typeParam Database - Codegen database type (optional; falls back to `Record<string, unknown>`)
 * @typeParam SchemaName - Postgres schema name (default: `"public"`)
 * @typeParam TableName - Table name string literal
 * @typeParam Result - Resolved row type for this builder instance
 */
export declare class DatabaseBuilder<Database = Record<string, Record<string, unknown>>, SchemaName extends string = "public", TableName extends string = string, Result = ExtractRow<Database, TableName, SchemaName>[]> implements PromiseLike<FakebaseResponse<Result>> {
    private readonly _kernel;
    private readonly _table;
    private readonly _schema;
    private _operation;
    private _filters;
    private _select;
    private _orderBy;
    private _limit;
    private _offset;
    private _single;
    private _maybeSingle;
    private _count;
    private _returning;
    private _insertData;
    private _updateData;
    private _upsertData;
    private _onConflict;
    private _abortSignal;
    constructor(kernel: FakebaseKernel, table: string, schema?: string);
    /**
     * Perform a SELECT query (or mark returning columns after a mutation).
     *
     * @param columns - Comma-separated column list, or `*` for all. Defaults to `*`.
     * @param options - `{ count: 'exact' | 'planned' | 'estimated' }` to include row count.
     */
    select(columns?: string, options?: {
        count?: "exact" | "planned" | "estimated";
        head?: boolean;
    }): DatabaseBuilder<Database, SchemaName, TableName, ExtractRow<Database, TableName, SchemaName>[]>;
    /**
     * Insert one or more rows. Chain `.select()` to get the inserted rows back.
     */
    insert(values: ExtractInsert<Database, TableName, SchemaName> | ExtractInsert<Database, TableName, SchemaName>[]): DatabaseBuilder<Database, SchemaName, TableName, null>;
    /**
     * Update rows that match the current filter set.
     * Chain `.select()` to return the updated rows.
     */
    update(values: ExtractUpdate<Database, TableName, SchemaName>): DatabaseBuilder<Database, SchemaName, TableName, null>;
    /**
     * Upsert one or more rows. Existing rows (matched by `onConflict` column or PK)
     * are updated; missing rows are inserted.
     */
    upsert(values: ExtractInsert<Database, TableName, SchemaName> | ExtractInsert<Database, TableName, SchemaName>[], options?: {
        onConflict?: string;
        ignoreDuplicates?: boolean;
    }): DatabaseBuilder<Database, SchemaName, TableName, null>;
    /**
     * Delete rows matching the current filter set.
     * Chain `.select()` to return the deleted rows.
     */
    delete(): DatabaseBuilder<Database, SchemaName, TableName, null>;
    /** Filter: column = value */
    eq(column: string, value: unknown): this;
    /** Filter: column != value */
    neq(column: string, value: unknown): this;
    /** Filter: column > value */
    gt(column: string, value: unknown): this;
    /** Filter: column >= value */
    gte(column: string, value: unknown): this;
    /** Filter: column < value */
    lt(column: string, value: unknown): this;
    /** Filter: column <= value */
    lte(column: string, value: unknown): this;
    /** Filter: column LIKE pattern (case-sensitive) */
    like(column: string, pattern: string): this;
    /** Filter: column ILIKE pattern (case-insensitive) */
    ilike(column: string, pattern: string): this;
    /** Filter: column IS null | true | false */
    is(column: string, value: null | boolean): this;
    /** Filter: column IN (values) */
    in(column: string, values: unknown[]): this;
    /** Filter: column @> value (array/jsonb contains) */
    contains(column: string, value: unknown): this;
    /** Filter: column <@ value (array/jsonb contained by) */
    containedBy(column: string, value: unknown): this;
    /** Filter: column && value (arrays overlap) */
    overlaps(column: string, value: unknown): this;
    /**
     * Filter: multiple equality conditions ANDed together.
     * Equivalent to calling `.eq()` for each key/value pair.
     */
    match(query: Record<string, unknown>): this;
    /**
     * Negate a filter: `column` `operator` `value` is added as NOT.
     *
     * @example
     * .not('status', 'in', ['draft', 'archived'])
     */
    not(column: string, operator: string, value: unknown): this;
    /**
     * Combine filters with OR using a PostgREST filter string.
     *
     * @example
     * .or('name.eq.alice,age.gt.18')
     * .or('and(name.eq.alice,age.gt.18),email.like.%@corp.com')
     */
    or(filters: string, _opts?: {
        referencedTable?: string;
    }): this;
    /**
     * Generic filter — passes the raw operator through to the kernel.
     * Useful for operators not exposed as dedicated methods (e.g. `fts`).
     */
    filter(column: string, operator: string, value: unknown): this;
    private _addFilter;
    /**
     * Sort results by a column.
     *
     * @param column - Column name.
     * @param options - `ascending` (default true), `nullsFirst`.
     */
    order(column: string, options?: {
        ascending?: boolean;
        nullsFirst?: boolean;
        referencedTable?: string;
    }): this;
    /** Limit the number of rows returned. */
    limit(count: number, _options?: {
        referencedTable?: string;
    }): this;
    /**
     * Return a range of rows (0-based, inclusive).
     * Equivalent to `offset(from).limit(to - from + 1)`.
     */
    range(from: number, to: number, _options?: {
        referencedTable?: string;
    }): this;
    /** Attach an AbortSignal to cancel the query. */
    abortSignal(signal: AbortSignal): this;
    /**
     * Expect exactly one row. Errors with PGRST116 if 0 or 2+ rows are returned.
     */
    single(): DatabaseBuilder<Database, SchemaName, TableName, ExtractRow<Database, TableName, SchemaName>>;
    /**
     * Return null when 0 rows, the row when exactly 1, or error when 2+ rows.
     */
    maybeSingle(): DatabaseBuilder<Database, SchemaName, TableName, ExtractRow<Database, TableName, SchemaName> | null>;
    /**
     * Execute the query and return the result as a CSV string.
     */
    csv(): Promise<{
        data: string | null;
        error: FakebaseError | null;
    }>;
    then<TResult1 = FakebaseResponse<Result>, TResult2 = never>(onfulfilled?: ((value: FakebaseResponse<Result>) => TResult1 | PromiseLike<TResult1>) | null | undefined, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined): Promise<TResult1 | TResult2>;
    private _buildPlan;
    private _execute;
}
export {};
//# sourceMappingURL=database-builder.d.ts.map