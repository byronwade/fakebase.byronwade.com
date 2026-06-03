/**
 * DatabaseBuilder — lazy, fluent query builder that mirrors the
 * `@supabase/supabase-js` PostgREST client API.
 *
 * The builder accumulates state synchronously and executes lazily when
 * awaited (via the `.then()` thenable hook) or when `.csv()` is called.
 */

import { FakebaseError, FakebaseErrorCode } from "@byronwade/core";
import type {
  FakebaseKernel,
  FilterItem,
  PlanFilterOperator,
  OrderItem,
  QueryPlan,
  SimpleFilter,
} from "@byronwade/core";

// ---------------------------------------------------------------------------
// Database generic helpers (mirrors @supabase/supabase-js codegen shape)
// ---------------------------------------------------------------------------

type GenericSchema = {
  Tables: Record<
    string,
    {
      Row: Record<string, unknown>;
      Insert: Record<string, unknown>;
      Update: Record<string, unknown>;
    }
  >;
  Views: Record<string, { Row: Record<string, unknown> }>;
};

type GenericDatabase = Record<string, GenericSchema>;

type ExtractRow<
  Database,
  TableName extends string,
  SchemaName extends string = "public",
> = Database extends GenericDatabase
  ? SchemaName extends keyof Database
    ? TableName extends keyof Database[SchemaName]["Tables"]
      ? Database[SchemaName]["Tables"][TableName]["Row"]
      : Record<string, unknown>
    : Record<string, unknown>
  : Record<string, unknown>;

type ExtractInsert<
  Database,
  TableName extends string,
  SchemaName extends string = "public",
> = Database extends GenericDatabase
  ? SchemaName extends keyof Database
    ? TableName extends keyof Database[SchemaName]["Tables"]
      ? Database[SchemaName]["Tables"][TableName]["Insert"]
      : Record<string, unknown>
    : Record<string, unknown>
  : Record<string, unknown>;

type ExtractUpdate<
  Database,
  TableName extends string,
  SchemaName extends string = "public",
> = Database extends GenericDatabase
  ? SchemaName extends keyof Database
    ? TableName extends keyof Database[SchemaName]["Tables"]
      ? Database[SchemaName]["Tables"][TableName]["Update"]
      : Record<string, unknown>
    : Record<string, unknown>
  : Record<string, unknown>;

/** Shape returned by every awaited builder call. */
export interface FakebaseResponse<T> {
  data: T | null;
  error: FakebaseError | null;
  count: number | null;
  status: number;
  statusText: string;
}

// ---------------------------------------------------------------------------
// PostgREST filter-string parser (used by .or())
// ---------------------------------------------------------------------------

/**
 * Split a comma-separated PostgREST filter string at the top level,
 * respecting nested parentheses.
 */
function splitTopLevel(str: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "(") depth++;
    else if (str[i] === ")") depth--;
    else if (str[i] === "," && depth === 0) {
      parts.push(str.slice(start, i).trim());
      start = i + 1;
    }
  }
  const last = str.slice(start).trim();
  if (last) parts.push(last);
  return parts;
}

/** Coerce a PostgREST value string to a JS value. */
function coerceValue(raw: string): unknown {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  const n = Number(raw);
  if (raw !== "" && !isNaN(n)) return n;
  // Array literal: {1,2,3}
  if (raw.startsWith("{") && raw.endsWith("}")) {
    return raw
      .slice(1, -1)
      .split(",")
      .map((v) => coerceValue(v.trim()));
  }
  return raw;
}

function parseSingleFilter(part: string): FilterItem {
  // Nested: and(...), or(...)
  if (/^and\(/i.test(part) && part.endsWith(")")) {
    return { type: "and", filters: parseFilterString(part.slice(4, -1)) };
  }
  if (/^or\(/i.test(part) && part.endsWith(")")) {
    return { type: "or", filters: parseFilterString(part.slice(3, -1)) };
  }

  let negate = false;
  let s = part;
  if (s.startsWith("not.")) {
    negate = true;
    s = s.slice(4);
  }

  const d1 = s.indexOf(".");
  if (d1 === -1) {
    return { type: "simple", column: s, operator: "eq", value: undefined };
  }
  const column = s.slice(0, d1);
  const rest = s.slice(d1 + 1);
  const d2 = rest.indexOf(".");
  const operator = d2 === -1 ? rest : rest.slice(0, d2);
  const rawValue = d2 === -1 ? "" : rest.slice(d2 + 1);

  return {
    type: "simple",
    column,
    operator: operator as PlanFilterOperator,
    value: coerceValue(rawValue),
    negate,
  } satisfies SimpleFilter;
}

/** Parse a PostgREST filter string like `"name.eq.alice,age.gt.18"`. */
function parseFilterString(str: string): FilterItem[] {
  return splitTopLevel(str).map(parseSingleFilter);
}

/** Parse the column list from a select string. */
function parseSelectColumns(select?: string): string[] | undefined {
  if (!select || select.trim() === "*") return undefined;
  return select
    .split(",")
    .map((c) => c.trim().split("(")[0]?.trim() ?? c.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok(status: number): string {
  if (status >= 200 && status < 300) return "OK";
  if (status === 400) return "Bad Request";
  if (status === 404) return "Not Found";
  if (status === 406) return "Not Acceptable";
  if (status === 409) return "Conflict";
  return "Error";
}

function successResponse<T>(
  data: T,
  count: number | null = null,
  status = 200,
): FakebaseResponse<T> {
  return { data, error: null, count, status, statusText: ok(status) };
}

function errorResponse<T>(error: FakebaseError): FakebaseResponse<T> {
  return {
    data: null,
    error,
    count: null,
    status: error.status,
    statusText: ok(error.status),
  };
}

function toFakebaseError(err: unknown): FakebaseError {
  if (err instanceof FakebaseError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  return new FakebaseError(FakebaseErrorCode.ADAPTER_ERROR, msg);
}

/** Rows → CSV string. */
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);

  function escape(v: unknown): string {
    const s = v === null || v === undefined ? "" : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// DatabaseBuilder
// ---------------------------------------------------------------------------

type Operation = "select" | "insert" | "update" | "upsert" | "delete";

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
export class DatabaseBuilder<
  Database = Record<string, Record<string, unknown>>,
  SchemaName extends string = "public",
  TableName extends string = string,
  Result = ExtractRow<Database, TableName, SchemaName>[],
> implements PromiseLike<FakebaseResponse<Result>> {
  private readonly _kernel: FakebaseKernel;
  private readonly _table: string;
  private readonly _schema: string;
  private _operation: Operation | undefined = undefined;
  private _filters: FilterItem[] = [];
  private _select: string[] | undefined = undefined;
  private _orderBy: OrderItem[] = [];
  private _limit: number | undefined = undefined;
  private _offset: number | undefined = undefined;
  private _single = false;
  private _maybeSingle = false;
  private _count: "exact" | "planned" | "estimated" | undefined = undefined;
  private _returning = false;
  private _insertData: Record<string, unknown>[] | undefined = undefined;
  private _updateData: Record<string, unknown> | undefined = undefined;
  private _upsertData: Record<string, unknown>[] | undefined = undefined;
  private _onConflict: string | undefined = undefined;
  private _abortSignal: AbortSignal | undefined = undefined;

  constructor(kernel: FakebaseKernel, table: string, schema = "public") {
    this._kernel = kernel;
    this._table = table;
    this._schema = schema;
  }

  // -------------------------------------------------------------------------
  // SELECT
  // -------------------------------------------------------------------------

  /**
   * Perform a SELECT query (or mark returning columns after a mutation).
   *
   * @param columns - Comma-separated column list, or `*` for all. Defaults to `*`.
   * @param options - `{ count: 'exact' | 'planned' | 'estimated' }` to include row count.
   */
  select(
    columns?: string,
    options?: { count?: "exact" | "planned" | "estimated"; head?: boolean },
  ): DatabaseBuilder<
    Database,
    SchemaName,
    TableName,
    ExtractRow<Database, TableName, SchemaName>[]
  > {
    const parsed = parseSelectColumns(columns);
    if (this._operation && this._operation !== "select") {
      // Chained after a mutation — flip to returning mode
      this._returning = true;
      this._select = parsed;
    } else {
      this._operation = "select";
      this._select = parsed;
    }
    if (options?.count) this._count = options.count;
    return this as unknown as DatabaseBuilder<
      Database,
      SchemaName,
      TableName,
      ExtractRow<Database, TableName, SchemaName>[]
    >;
  }

  // -------------------------------------------------------------------------
  // MUTATIONS
  // -------------------------------------------------------------------------

  /**
   * Insert one or more rows. Chain `.select()` to get the inserted rows back.
   */
  insert(
    values:
      | ExtractInsert<Database, TableName, SchemaName>
      | ExtractInsert<Database, TableName, SchemaName>[],
  ): DatabaseBuilder<Database, SchemaName, TableName, null> {
    this._operation = "insert";
    this._insertData = (Array.isArray(values) ? values : [values]) as Record<
      string,
      unknown
    >[];
    return this as unknown as DatabaseBuilder<Database, SchemaName, TableName, null>;
  }

  /**
   * Update rows that match the current filter set.
   * Chain `.select()` to return the updated rows.
   */
  update(
    values: ExtractUpdate<Database, TableName, SchemaName>,
  ): DatabaseBuilder<Database, SchemaName, TableName, null> {
    this._operation = "update";
    this._updateData = values as Record<string, unknown>;
    return this as unknown as DatabaseBuilder<Database, SchemaName, TableName, null>;
  }

  /**
   * Upsert one or more rows. Existing rows (matched by `onConflict` column or PK)
   * are updated; missing rows are inserted.
   */
  upsert(
    values:
      | ExtractInsert<Database, TableName, SchemaName>
      | ExtractInsert<Database, TableName, SchemaName>[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): DatabaseBuilder<Database, SchemaName, TableName, null> {
    this._operation = "upsert";
    this._upsertData = (Array.isArray(values) ? values : [values]) as Record<
      string,
      unknown
    >[];
    this._onConflict = options?.onConflict;
    return this as unknown as DatabaseBuilder<Database, SchemaName, TableName, null>;
  }

  /**
   * Delete rows matching the current filter set.
   * Chain `.select()` to return the deleted rows.
   */
  delete(): DatabaseBuilder<Database, SchemaName, TableName, null> {
    this._operation = "delete";
    return this as unknown as DatabaseBuilder<Database, SchemaName, TableName, null>;
  }

  // -------------------------------------------------------------------------
  // FILTER methods (all chainable, return `this`)
  // -------------------------------------------------------------------------

  /** Filter: column = value */
  eq(column: string, value: unknown): this {
    return this._addFilter(column, "eq", value);
  }

  /** Filter: column != value */
  neq(column: string, value: unknown): this {
    return this._addFilter(column, "neq", value);
  }

  /** Filter: column > value */
  gt(column: string, value: unknown): this {
    return this._addFilter(column, "gt", value);
  }

  /** Filter: column >= value */
  gte(column: string, value: unknown): this {
    return this._addFilter(column, "gte", value);
  }

  /** Filter: column < value */
  lt(column: string, value: unknown): this {
    return this._addFilter(column, "lt", value);
  }

  /** Filter: column <= value */
  lte(column: string, value: unknown): this {
    return this._addFilter(column, "lte", value);
  }

  /** Filter: column LIKE pattern (case-sensitive) */
  like(column: string, pattern: string): this {
    return this._addFilter(column, "like", pattern);
  }

  /** Filter: column ILIKE pattern (case-insensitive) */
  ilike(column: string, pattern: string): this {
    return this._addFilter(column, "ilike", pattern);
  }

  /** Filter: column IS null | true | false */
  is(column: string, value: null | boolean): this {
    return this._addFilter(column, "is", value);
  }

  /** Filter: column IN (values) */
  in(column: string, values: unknown[]): this {
    return this._addFilter(column, "in", values);
  }

  /** Filter: column @> value (array/jsonb contains) */
  contains(column: string, value: unknown): this {
    return this._addFilter(column, "contains", value);
  }

  /** Filter: column <@ value (array/jsonb contained by) */
  containedBy(column: string, value: unknown): this {
    return this._addFilter(column, "contained_by", value);
  }

  /** Filter: column && value (arrays overlap) */
  overlaps(column: string, value: unknown): this {
    return this._addFilter(column, "overlaps", value);
  }

  /**
   * Filter: multiple equality conditions ANDed together.
   * Equivalent to calling `.eq()` for each key/value pair.
   */
  match(query: Record<string, unknown>): this {
    for (const [col, val] of Object.entries(query)) {
      this._addFilter(col, "eq", val);
    }
    return this;
  }

  /**
   * Negate a filter: `column` `operator` `value` is added as NOT.
   *
   * @example
   * .not('status', 'in', ['draft', 'archived'])
   */
  not(column: string, operator: string, value: unknown): this {
    this._filters.push({
      type: "simple",
      column,
      operator: operator as PlanFilterOperator,
      value,
      negate: true,
    } satisfies SimpleFilter);
    return this;
  }

  /**
   * Combine filters with OR using a PostgREST filter string.
   *
   * @example
   * .or('name.eq.alice,age.gt.18')
   * .or('and(name.eq.alice,age.gt.18),email.like.%@corp.com')
   */
  or(filters: string, _opts?: { referencedTable?: string }): this {
    const parsed = parseFilterString(filters);
    this._filters.push({ type: "or", filters: parsed });
    return this;
  }

  /**
   * Generic filter — passes the raw operator through to the kernel.
   * Useful for operators not exposed as dedicated methods (e.g. `fts`).
   */
  filter(column: string, operator: string, value: unknown): this {
    return this._addFilter(column, operator as PlanFilterOperator, value);
  }

  private _addFilter(
    column: string,
    operator: PlanFilterOperator,
    value: unknown,
  ): this {
    this._filters.push({
      type: "simple",
      column,
      operator,
      value,
    } satisfies SimpleFilter);
    return this;
  }

  // -------------------------------------------------------------------------
  // MODIFIERS
  // -------------------------------------------------------------------------

  /**
   * Sort results by a column.
   *
   * @param column - Column name.
   * @param options - `ascending` (default true), `nullsFirst`.
   */
  order(
    column: string,
    options?: {
      ascending?: boolean;
      nullsFirst?: boolean;
      referencedTable?: string;
    },
  ): this {
    this._orderBy.push({
      column,
      ascending: options?.ascending ?? true,
      nullsFirst: options?.nullsFirst,
    });
    return this;
  }

  /** Limit the number of rows returned. */
  limit(count: number, _options?: { referencedTable?: string }): this {
    this._limit = count;
    return this;
  }

  /**
   * Return a range of rows (0-based, inclusive).
   * Equivalent to `offset(from).limit(to - from + 1)`.
   */
  range(from: number, to: number, _options?: { referencedTable?: string }): this {
    this._offset = from;
    this._limit = to - from + 1;
    return this;
  }

  /** Attach an AbortSignal to cancel the query. */
  abortSignal(signal: AbortSignal): this {
    this._abortSignal = signal;
    return this;
  }

  // -------------------------------------------------------------------------
  // SINGLE-ROW helpers
  // -------------------------------------------------------------------------

  /**
   * Expect exactly one row. Errors with PGRST116 if 0 or 2+ rows are returned.
   */
  single(): DatabaseBuilder<
    Database,
    SchemaName,
    TableName,
    ExtractRow<Database, TableName, SchemaName>
  > {
    this._single = true;
    this._maybeSingle = false;
    return this as unknown as DatabaseBuilder<
      Database,
      SchemaName,
      TableName,
      ExtractRow<Database, TableName, SchemaName>
    >;
  }

  /**
   * Return null when 0 rows, the row when exactly 1, or error when 2+ rows.
   */
  maybeSingle(): DatabaseBuilder<
    Database,
    SchemaName,
    TableName,
    ExtractRow<Database, TableName, SchemaName> | null
  > {
    this._maybeSingle = true;
    this._single = false;
    return this as unknown as DatabaseBuilder<
      Database,
      SchemaName,
      TableName,
      ExtractRow<Database, TableName, SchemaName> | null
    >;
  }

  // -------------------------------------------------------------------------
  // CSV output
  // -------------------------------------------------------------------------

  /**
   * Execute the query and return the result as a CSV string.
   */
  async csv(): Promise<{ data: string | null; error: FakebaseError | null }> {
    try {
      if (this._abortSignal?.aborted) {
        throw new FakebaseError(
          FakebaseErrorCode.INVALID_QUERY,
          "The request was aborted.",
        );
      }
      const plan = this._buildPlan();
      const result = await this._kernel.query(plan);
      return { data: toCsv(result.rows), error: null };
    } catch (err) {
      return { data: null, error: toFakebaseError(err) };
    }
  }

  // -------------------------------------------------------------------------
  // Thenable — executes when awaited
  // -------------------------------------------------------------------------

  then<TResult1 = FakebaseResponse<Result>, TResult2 = never>(
    onfulfilled?:
      | ((value: FakebaseResponse<Result>) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null
      | undefined,
  ): Promise<TResult1 | TResult2> {
    return this._execute().then(onfulfilled, onrejected);
  }

  // -------------------------------------------------------------------------
  // Internal execution
  // -------------------------------------------------------------------------

  private _buildPlan(): QueryPlan {
    const operation = this._operation ?? "select";
    return {
      schema: this._schema,
      table: this._table,
      operation,
      filters: this._filters,
      select: this._select,
      orderBy: this._orderBy,
      limit: this._limit,
      offset: this._offset,
      insertData: this._insertData,
      updateData: this._updateData,
      upsertData: this._upsertData,
      onConflict: this._onConflict,
      returning: this._returning,
      count: this._count,
    };
  }

  private async _execute(): Promise<FakebaseResponse<Result>> {
    if (this._abortSignal?.aborted) {
      return errorResponse<Result>(
        new FakebaseError(FakebaseErrorCode.INVALID_QUERY, "The request was aborted."),
      );
    }

    try {
      const plan = this._buildPlan();
      const result = await this._kernel.query(plan);
      const count = result.count !== undefined ? result.count : null;
      const operation = plan.operation;

      // Mutations without returning always get data: null
      if (
        (operation === "insert" ||
          operation === "update" ||
          operation === "upsert" ||
          operation === "delete") &&
        !plan.returning
      ) {
        return successResponse<Result>(null as unknown as Result, null, 204);
      }

      const rows = result.rows;

      // Single-row semantics
      if (this._single) {
        if (rows.length !== 1) {
          return errorResponse<Result>(FakebaseError.singleRowViolation(rows.length));
        }
        return successResponse<Result>(rows[0] as Result, count);
      }

      if (this._maybeSingle) {
        if (rows.length > 1) {
          return errorResponse<Result>(FakebaseError.singleRowViolation(rows.length));
        }
        return successResponse<Result>((rows[0] ?? null) as Result, count);
      }

      return successResponse<Result>(rows as Result, count);
    } catch (err) {
      return errorResponse<Result>(toFakebaseError(err));
    }
  }
}
