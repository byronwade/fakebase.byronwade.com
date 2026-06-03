/**
 * DatabaseBuilder — lazy, fluent query builder that mirrors the
 * `@supabase/supabase-js` PostgREST client API.
 *
 * The builder accumulates state synchronously and executes lazily when
 * awaited (via the `.then()` thenable hook) or when `.csv()` is called.
 */
import { FakebaseError, FakebaseErrorCode } from "@fakebase/core";
// ---------------------------------------------------------------------------
// PostgREST filter-string parser (used by .or())
// ---------------------------------------------------------------------------
/**
 * Split a comma-separated PostgREST filter string at the top level,
 * respecting nested parentheses.
 */
function splitTopLevel(str) {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < str.length; i++) {
        if (str[i] === "(")
            depth++;
        else if (str[i] === ")")
            depth--;
        else if (str[i] === "," && depth === 0) {
            parts.push(str.slice(start, i).trim());
            start = i + 1;
        }
    }
    const last = str.slice(start).trim();
    if (last)
        parts.push(last);
    return parts;
}
/** Coerce a PostgREST value string to a JS value. */
function coerceValue(raw) {
    if (raw === "null")
        return null;
    if (raw === "true")
        return true;
    if (raw === "false")
        return false;
    const n = Number(raw);
    if (raw !== "" && !isNaN(n))
        return n;
    // Array literal: {1,2,3}
    if (raw.startsWith("{") && raw.endsWith("}")) {
        return raw
            .slice(1, -1)
            .split(",")
            .map((v) => coerceValue(v.trim()));
    }
    return raw;
}
function parseSingleFilter(part) {
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
        operator: operator,
        value: coerceValue(rawValue),
        negate,
    };
}
/** Parse a PostgREST filter string like `"name.eq.alice,age.gt.18"`. */
function parseFilterString(str) {
    return splitTopLevel(str).map(parseSingleFilter);
}
/** Parse the column list from a select string. */
function parseSelectColumns(select) {
    if (!select || select.trim() === "*")
        return undefined;
    return select
        .split(",")
        .map((c) => c.trim().split("(")[0]?.trim() ?? c.trim())
        .filter(Boolean);
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function ok(status) {
    if (status >= 200 && status < 300)
        return "OK";
    if (status === 400)
        return "Bad Request";
    if (status === 404)
        return "Not Found";
    if (status === 406)
        return "Not Acceptable";
    if (status === 409)
        return "Conflict";
    return "Error";
}
function successResponse(data, count = null, status = 200) {
    return { data, error: null, count, status, statusText: ok(status) };
}
function errorResponse(error) {
    return {
        data: null,
        error,
        count: null,
        status: error.status,
        statusText: ok(error.status),
    };
}
function toFakebaseError(err) {
    if (err instanceof FakebaseError)
        return err;
    const msg = err instanceof Error ? err.message : String(err);
    return new FakebaseError(FakebaseErrorCode.ADAPTER_ERROR, msg);
}
/** Rows → CSV string. */
function toCsv(rows) {
    if (rows.length === 0)
        return "";
    const headers = Object.keys(rows[0]);
    function escape(v) {
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
export class DatabaseBuilder {
    _kernel;
    _table;
    _schema;
    _operation = undefined;
    _filters = [];
    _select = undefined;
    _orderBy = [];
    _limit = undefined;
    _offset = undefined;
    _single = false;
    _maybeSingle = false;
    _count = undefined;
    _returning = false;
    _insertData = undefined;
    _updateData = undefined;
    _upsertData = undefined;
    _onConflict = undefined;
    _abortSignal = undefined;
    constructor(kernel, table, schema = "public") {
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
    select(columns, options) {
        const parsed = parseSelectColumns(columns);
        if (this._operation && this._operation !== "select") {
            // Chained after a mutation — flip to returning mode
            this._returning = true;
            this._select = parsed;
        }
        else {
            this._operation = "select";
            this._select = parsed;
        }
        if (options?.count)
            this._count = options.count;
        return this;
    }
    // -------------------------------------------------------------------------
    // MUTATIONS
    // -------------------------------------------------------------------------
    /**
     * Insert one or more rows. Chain `.select()` to get the inserted rows back.
     */
    insert(values) {
        this._operation = "insert";
        this._insertData = (Array.isArray(values) ? values : [values]);
        return this;
    }
    /**
     * Update rows that match the current filter set.
     * Chain `.select()` to return the updated rows.
     */
    update(values) {
        this._operation = "update";
        this._updateData = values;
        return this;
    }
    /**
     * Upsert one or more rows. Existing rows (matched by `onConflict` column or PK)
     * are updated; missing rows are inserted.
     */
    upsert(values, options) {
        this._operation = "upsert";
        this._upsertData = (Array.isArray(values) ? values : [values]);
        this._onConflict = options?.onConflict;
        return this;
    }
    /**
     * Delete rows matching the current filter set.
     * Chain `.select()` to return the deleted rows.
     */
    delete() {
        this._operation = "delete";
        return this;
    }
    // -------------------------------------------------------------------------
    // FILTER methods (all chainable, return `this`)
    // -------------------------------------------------------------------------
    /** Filter: column = value */
    eq(column, value) {
        return this._addFilter(column, "eq", value);
    }
    /** Filter: column != value */
    neq(column, value) {
        return this._addFilter(column, "neq", value);
    }
    /** Filter: column > value */
    gt(column, value) {
        return this._addFilter(column, "gt", value);
    }
    /** Filter: column >= value */
    gte(column, value) {
        return this._addFilter(column, "gte", value);
    }
    /** Filter: column < value */
    lt(column, value) {
        return this._addFilter(column, "lt", value);
    }
    /** Filter: column <= value */
    lte(column, value) {
        return this._addFilter(column, "lte", value);
    }
    /** Filter: column LIKE pattern (case-sensitive) */
    like(column, pattern) {
        return this._addFilter(column, "like", pattern);
    }
    /** Filter: column ILIKE pattern (case-insensitive) */
    ilike(column, pattern) {
        return this._addFilter(column, "ilike", pattern);
    }
    /** Filter: column IS null | true | false */
    is(column, value) {
        return this._addFilter(column, "is", value);
    }
    /** Filter: column IN (values) */
    in(column, values) {
        return this._addFilter(column, "in", values);
    }
    /** Filter: column @> value (array/jsonb contains) */
    contains(column, value) {
        return this._addFilter(column, "contains", value);
    }
    /** Filter: column <@ value (array/jsonb contained by) */
    containedBy(column, value) {
        return this._addFilter(column, "contained_by", value);
    }
    /** Filter: column && value (arrays overlap) */
    overlaps(column, value) {
        return this._addFilter(column, "overlaps", value);
    }
    /**
     * Filter: multiple equality conditions ANDed together.
     * Equivalent to calling `.eq()` for each key/value pair.
     */
    match(query) {
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
    not(column, operator, value) {
        this._filters.push({
            type: "simple",
            column,
            operator: operator,
            value,
            negate: true,
        });
        return this;
    }
    /**
     * Combine filters with OR using a PostgREST filter string.
     *
     * @example
     * .or('name.eq.alice,age.gt.18')
     * .or('and(name.eq.alice,age.gt.18),email.like.%@corp.com')
     */
    or(filters, _opts) {
        const parsed = parseFilterString(filters);
        this._filters.push({ type: "or", filters: parsed });
        return this;
    }
    /**
     * Generic filter — passes the raw operator through to the kernel.
     * Useful for operators not exposed as dedicated methods (e.g. `fts`).
     */
    filter(column, operator, value) {
        return this._addFilter(column, operator, value);
    }
    _addFilter(column, operator, value) {
        this._filters.push({
            type: "simple",
            column,
            operator,
            value,
        });
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
    order(column, options) {
        this._orderBy.push({
            column,
            ascending: options?.ascending ?? true,
            nullsFirst: options?.nullsFirst,
        });
        return this;
    }
    /** Limit the number of rows returned. */
    limit(count, _options) {
        this._limit = count;
        return this;
    }
    /**
     * Return a range of rows (0-based, inclusive).
     * Equivalent to `offset(from).limit(to - from + 1)`.
     */
    range(from, to, _options) {
        this._offset = from;
        this._limit = to - from + 1;
        return this;
    }
    /** Attach an AbortSignal to cancel the query. */
    abortSignal(signal) {
        this._abortSignal = signal;
        return this;
    }
    // -------------------------------------------------------------------------
    // SINGLE-ROW helpers
    // -------------------------------------------------------------------------
    /**
     * Expect exactly one row. Errors with PGRST116 if 0 or 2+ rows are returned.
     */
    single() {
        this._single = true;
        this._maybeSingle = false;
        return this;
    }
    /**
     * Return null when 0 rows, the row when exactly 1, or error when 2+ rows.
     */
    maybeSingle() {
        this._maybeSingle = true;
        this._single = false;
        return this;
    }
    // -------------------------------------------------------------------------
    // CSV output
    // -------------------------------------------------------------------------
    /**
     * Execute the query and return the result as a CSV string.
     */
    async csv() {
        try {
            if (this._abortSignal?.aborted) {
                throw new FakebaseError(FakebaseErrorCode.INVALID_QUERY, "The request was aborted.");
            }
            const plan = this._buildPlan();
            const result = await this._kernel.query(plan);
            return { data: toCsv(result.rows), error: null };
        }
        catch (err) {
            return { data: null, error: toFakebaseError(err) };
        }
    }
    // -------------------------------------------------------------------------
    // Thenable — executes when awaited
    // -------------------------------------------------------------------------
    then(onfulfilled, onrejected) {
        return this._execute().then(onfulfilled, onrejected);
    }
    // -------------------------------------------------------------------------
    // Internal execution
    // -------------------------------------------------------------------------
    _buildPlan() {
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
    async _execute() {
        if (this._abortSignal?.aborted) {
            return errorResponse(new FakebaseError(FakebaseErrorCode.INVALID_QUERY, "The request was aborted."));
        }
        try {
            const plan = this._buildPlan();
            const result = await this._kernel.query(plan);
            const count = result.count !== undefined ? result.count : null;
            const operation = plan.operation;
            // Mutations without returning always get data: null
            if ((operation === "insert" ||
                operation === "update" ||
                operation === "upsert" ||
                operation === "delete") &&
                !plan.returning) {
                return successResponse(null, null, 204);
            }
            const rows = result.rows;
            // Single-row semantics
            if (this._single) {
                if (rows.length !== 1) {
                    return errorResponse(FakebaseError.singleRowViolation(rows.length));
                }
                return successResponse(rows[0], count);
            }
            if (this._maybeSingle) {
                if (rows.length > 1) {
                    return errorResponse(FakebaseError.singleRowViolation(rows.length));
                }
                return successResponse((rows[0] ?? null), count);
            }
            return successResponse(rows, count);
        }
        catch (err) {
            return errorResponse(toFakebaseError(err));
        }
    }
}
//# sourceMappingURL=database-builder.js.map