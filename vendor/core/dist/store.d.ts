/**
 * FakeStore — Map-based in-memory row store with primary-key and secondary-key
 * indexing. Used by the MemoryAdapter (and optionally JsonAdapter) as the
 * canonical row container.
 */
import type { AdapterRow } from "./adapter.js";
import type { TableIR } from "./schema/ir.js";
/**
 * Thread-safe (single-threaded JS) in-memory store.
 * One `FakeStore` instance is shared across all tables in an adapter.
 */
export declare class FakeStore {
    private readonly tables;
    private tableKey;
    /** Register a table schema. Must be called before any DML on that table. */
    registerTable(tableSchema: TableIR): void;
    private getStore;
    /** Insert a row. Throws on primary-key collision. */
    insert(schema: string, table: string, row: AdapterRow): AdapterRow;
    /** Retrieve a row by primary key (undefined when absent). */
    getByPk(schema: string, table: string, pk: string | number): AdapterRow | undefined;
    /** Return all rows in insertion order. */
    list(schema: string, table: string): AdapterRow[];
    /** Apply a partial patch to the row with the given primary key. */
    update(schema: string, table: string, pk: string | number, patch: AdapterRow): AdapterRow;
    /** Delete the row with the given primary key. Returns the deleted row. */
    delete(schema: string, table: string, pk: string | number): AdapterRow | undefined;
    /** Wipe all rows in a table (keeps schema registration). */
    truncate(schema: string, table: string): void;
    private indexRow;
    private unindexRow;
}
//# sourceMappingURL=store.d.ts.map