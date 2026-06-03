/**
 * Supabase-compatible query builder for Fakebase.
 *
 * Mirrors the @supabase/supabase-js query builder API:
 * - Chainable filter methods (.eq, .neq, .gt, …)
 * - Operation methods (.select, .insert, .update, .delete, .upsert)
 * - Modifiers (.single, .maybeSingle, .order, .limit, .range)
 * - Thenable — await the builder to execute the query.
 */
import { parseOrString } from "@fakebase/core";
function ok(data, count = null) {
    return { data, error: null, count, status: 200, statusText: "OK" };
}
function err(message, status = 400) {
    return {
        data: null,
        error: { message },
        count: null,
        status,
        statusText: message,
    };
}
/**
 * Chainable query builder. All filter/modifier methods return `this`.
 * Awaiting the builder (or calling `.then()`) executes the accumulated query.
 */
export class QueryBuilder {
    _table;
    _schema;
    _adapterPromise;
    _mode = "select";
    _columns = undefined;
    _filters = [];
    _orderBy = [];
    _limit = undefined;
    _offset = undefined;
    _single = false;
    _maybeSingle = false;
    _returning = true;
    _countMode = undefined;
    // operation data
    _insertData = undefined;
    _updateData = undefined;
    _upsertData = undefined;
    _onConflict = undefined;
    constructor(table, schema, adapterPromise) {
        this._table = table;
        this._schema = schema;
        this._adapterPromise = adapterPromise;
    }
    // ─── Operation setters ────────────────────────────────────────────────────
    /** Set mode to SELECT. Optionally specify columns. */
    select(columns = "*") {
        this._mode = "select";
        if (columns && columns !== "*") {
            this._columns = columns
                .split(",")
                .map((c) => c.trim())
                .filter(Boolean);
        }
        else {
            this._columns = undefined;
        }
        return this;
    }
    /** Set mode to INSERT. */
    insert(data) {
        this._mode = "insert";
        this._insertData = data;
        return this;
    }
    /** Set mode to UPDATE. */
    update(data) {
        this._mode = "update";
        this._updateData = data;
        return this;
    }
    /** Set mode to DELETE. */
    delete() {
        this._mode = "delete";
        return this;
    }
    /** Set mode to UPSERT. */
    upsert(data, options) {
        this._mode = "upsert";
        this._upsertData = data;
        this._onConflict = options?.onConflict;
        return this;
    }
    // ─── Filter methods ────────────────────────────────────────────────────────
    _addFilter(column, operator, value) {
        this._filters.push({ column, operator, value });
        return this;
    }
    eq(column, value) {
        return this._addFilter(column, "eq", value);
    }
    neq(column, value) {
        return this._addFilter(column, "neq", value);
    }
    gt(column, value) {
        return this._addFilter(column, "gt", value);
    }
    gte(column, value) {
        return this._addFilter(column, "gte", value);
    }
    lt(column, value) {
        return this._addFilter(column, "lt", value);
    }
    lte(column, value) {
        return this._addFilter(column, "lte", value);
    }
    like(column, pattern) {
        return this._addFilter(column, "like", pattern);
    }
    ilike(column, pattern) {
        return this._addFilter(column, "ilike", pattern);
    }
    is(column, value) {
        return this._addFilter(column, "is", value);
    }
    in(column, values) {
        return this._addFilter(column, "in", values);
    }
    contains(column, value) {
        return this._addFilter(column, "contains", value);
    }
    containedBy(column, value) {
        return this._addFilter(column, "containedBy", value);
    }
    overlaps(column, value) {
        return this._addFilter(column, "overlaps", value);
    }
    textSearch(column, query) {
        return this._addFilter(column, "match", query);
    }
    match(query) {
        for (const [col, val] of Object.entries(query)) {
            this._addFilter(col, "eq", val);
        }
        return this;
    }
    not(column, operator, value) {
        this._filters.push({
            column,
            operator: "not",
            value: { operator, value },
        });
        return this;
    }
    or(filters, options) {
        const prefix = options?.foreignTable ? `${options.foreignTable}.` : "";
        const orNode = parseOrString(prefix
            ? filters
                .split(",")
                .map((f) => `${prefix}${f}`)
                .join(",")
            : filters);
        this._filters.push(orNode);
        return this;
    }
    filter(column, operator, value) {
        return this._addFilter(column, operator, value);
    }
    // ─── Modifiers ─────────────────────────────────────────────────────────────
    order(column, options) {
        this._orderBy.push({
            column,
            ascending: options?.ascending ?? true,
            nullsFirst: options?.nullsFirst,
        });
        return this;
    }
    limit(count, options) {
        this._limit = count;
        return this;
    }
    range(from, to, options) {
        this._offset = from;
        this._limit = to - from + 1;
        return this;
    }
    /** Expect exactly one row. Errors if zero or more than one row. */
    single() {
        this._single = true;
        return this;
    }
    /** Return one row or null. Errors if more than one row. */
    maybeSingle() {
        this._maybeSingle = true;
        return this;
    }
    /** Request row count alongside the query. */
    count(countMode = "exact") {
        this._countMode = countMode;
        return this;
    }
    // ─── Execution ─────────────────────────────────────────────────────────────
    then(onfulfilled, onrejected) {
        return this._execute().then(onfulfilled, onrejected);
    }
    async _execute() {
        try {
            const adapter = await this._adapterPromise;
            switch (this._mode) {
                case "select":
                    return await this._execSelect(adapter);
                case "insert":
                    return await this._execInsert(adapter);
                case "update":
                    return await this._execUpdate(adapter);
                case "delete":
                    return await this._execDelete(adapter);
                case "upsert":
                    return await this._execUpsert(adapter);
                default:
                    return err("Unknown query mode");
            }
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return err(msg, 500);
        }
    }
    async _execSelect(adapter) {
        const result = await adapter.select(this._table, this._schema, {
            table: this._table,
            schema: this._schema,
            filters: this._filters,
            select: this._columns,
            orderBy: this._orderBy,
            limit: this._limit,
            offset: this._offset,
            count: this._countMode,
        });
        if (result.error) {
            return {
                data: null,
                error: { message: result.error.message },
                count: null,
                status: result.status,
                statusText: result.statusText,
            };
        }
        const rows = (result.data ?? []);
        if (this._single) {
            if (rows.length === 0) {
                return err("PGRST116: The result contains 0 rows", 406);
            }
            if (rows.length > 1) {
                return err("PGRST116: The result contains more than 1 row", 406);
            }
            return ok(rows[0], result.count);
        }
        if (this._maybeSingle) {
            if (rows.length > 1) {
                return err("PGRST116: The result contains more than 1 row", 406);
            }
            return ok((rows[0] ?? null), result.count);
        }
        return ok(rows, result.count);
    }
    async _execInsert(adapter) {
        if (this._insertData === undefined) {
            return err("No data provided for insert");
        }
        const rows = Array.isArray(this._insertData) ? this._insertData : [this._insertData];
        const inserted = await adapter.insert(this._table, this._schema, rows);
        if (this._columns !== undefined) {
            const cols = this._columns;
            return ok(inserted.map((r) => projectRow(r, cols)));
        }
        return ok(inserted);
    }
    async _execUpdate(adapter) {
        if (this._updateData === undefined) {
            return err("No data provided for update");
        }
        const updated = await adapter.update(this._table, this._schema, this._updateData, this._filters);
        if (this._columns !== undefined) {
            const cols = this._columns;
            return ok(updated.map((r) => projectRow(r, cols)));
        }
        return ok(updated);
    }
    async _execDelete(adapter) {
        const deleted = await adapter.delete(this._table, this._schema, this._filters);
        return ok(deleted);
    }
    async _execUpsert(adapter) {
        if (this._upsertData === undefined) {
            return err("No data provided for upsert");
        }
        const rows = Array.isArray(this._upsertData) ? this._upsertData : [this._upsertData];
        const upserted = await adapter.upsert(this._table, this._schema, rows, this._onConflict);
        return ok(upserted);
    }
}
function projectRow(row, columns) {
    const out = {};
    for (const col of columns) {
        out[col] = row[col];
    }
    return out;
}
//# sourceMappingURL=query-builder.js.map