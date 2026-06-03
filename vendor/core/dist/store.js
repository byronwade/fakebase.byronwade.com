/**
 * FakeStore — Map-based in-memory row store with primary-key and secondary-key
 * indexing. Used by the MemoryAdapter (and optionally JsonAdapter) as the
 * canonical row container.
 */
import { FakebaseError, FakebaseErrorCode } from "./errors.js";
/** Serialize a primary-key value to a string map key. */
function pkStr(value) {
    if (value === null || value === undefined) {
        throw new FakebaseError(FakebaseErrorCode.NOT_NULL_VIOLATION, "Primary key must not be null.");
    }
    return String(value);
}
/**
 * Thread-safe (single-threaded JS) in-memory store.
 * One `FakeStore` instance is shared across all tables in an adapter.
 */
export class FakeStore {
    tables = new Map();
    tableKey(schema, table) {
        return `${schema}.${table}`;
    }
    /** Register a table schema. Must be called before any DML on that table. */
    registerTable(tableSchema) {
        const key = this.tableKey(tableSchema.schema, tableSchema.name);
        if (this.tables.has(key))
            return;
        const indexes = new Map();
        for (const idx of tableSchema.indexes) {
            indexes.set(idx.name, new Map());
        }
        this.tables.set(key, {
            schema: tableSchema,
            byPk: new Map(),
            indexes,
        });
    }
    getStore(schema, table) {
        const store = this.tables.get(this.tableKey(schema, table));
        if (!store) {
            throw FakebaseError.tableMissing(`${schema}.${table}`);
        }
        return store;
    }
    /** Insert a row. Throws on primary-key collision. */
    insert(schema, table, row) {
        const store = this.getStore(schema, table);
        const pk = pkStr(row[store.schema.primaryKey]);
        if (store.byPk.has(pk)) {
            throw FakebaseError.uniqueViolation(table, store.schema.primaryKey);
        }
        const stored = { ...row };
        store.byPk.set(pk, stored);
        this.indexRow(store, pk, stored);
        return stored;
    }
    /** Retrieve a row by primary key (undefined when absent). */
    getByPk(schema, table, pk) {
        return this.getStore(schema, table).byPk.get(pkStr(pk));
    }
    /** Return all rows in insertion order. */
    list(schema, table) {
        return [...this.getStore(schema, table).byPk.values()];
    }
    /** Apply a partial patch to the row with the given primary key. */
    update(schema, table, pk, patch) {
        const store = this.getStore(schema, table);
        const pkKey = pkStr(pk);
        const existing = store.byPk.get(pkKey);
        if (!existing) {
            throw new FakebaseError(FakebaseErrorCode.ROW_NOT_FOUND, `Row with pk '${pkKey}' not found in '${schema}.${table}'.`);
        }
        this.unindexRow(store, pkKey, existing);
        const updated = { ...existing, ...patch };
        store.byPk.set(pkKey, updated);
        this.indexRow(store, pkKey, updated);
        return updated;
    }
    /** Delete the row with the given primary key. Returns the deleted row. */
    delete(schema, table, pk) {
        const store = this.getStore(schema, table);
        const pkKey = pkStr(pk);
        const row = store.byPk.get(pkKey);
        if (!row)
            return undefined;
        this.unindexRow(store, pkKey, row);
        store.byPk.delete(pkKey);
        return row;
    }
    /** Wipe all rows in a table (keeps schema registration). */
    truncate(schema, table) {
        const store = this.getStore(schema, table);
        store.byPk.clear();
        for (const idx of store.indexes.values()) {
            idx.clear();
        }
    }
    // ──────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────────────────
    indexRow(store, pk, row) {
        for (const [idxName, idxMap] of store.indexes) {
            const idxDef = store.schema.indexes.find((i) => i.name === idxName);
            if (!idxDef)
                continue;
            const idxKey = idxDef.columns.map((c) => String(row[c] ?? "")).join("|");
            let bucket = idxMap.get(idxKey);
            if (!bucket) {
                bucket = new Set();
                idxMap.set(idxKey, bucket);
            }
            bucket.add(pk);
        }
    }
    unindexRow(store, pk, row) {
        for (const [idxName, idxMap] of store.indexes) {
            const idxDef = store.schema.indexes.find((i) => i.name === idxName);
            if (!idxDef)
                continue;
            const idxKey = idxDef.columns.map((c) => String(row[c] ?? "")).join("|");
            idxMap.get(idxKey)?.delete(pk);
        }
    }
}
//# sourceMappingURL=store.js.map