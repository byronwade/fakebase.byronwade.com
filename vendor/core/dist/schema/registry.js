/**
 * Schema Registry — runtime lookup for tables, enums, and functions.
 * The registry is the single source of truth for schema metadata at runtime.
 */
import { FakebaseError } from "../errors.js";
export class SchemaRegistry {
    tables = new Map();
    enums = new Map();
    ir;
    constructor(schema) {
        this.ir = { ...schema, tables: [...schema.tables], enums: [...schema.enums] };
        for (const table of schema.tables) {
            this.tables.set(this.key(table.schema, table.name), table);
        }
        for (const e of schema.enums) {
            this.enums.set(this.key(e.schema, e.name), e);
        }
    }
    key(schema, name) {
        return `${schema}.${name}`;
    }
    /** Return the table IR or undefined when not found. */
    getTable(schema, name) {
        return this.tables.get(this.key(schema, name));
    }
    /**
     * Return the table IR, throwing `FakebaseError.tableMissing` when absent.
     * Use this in hot paths where the table is expected to exist.
     */
    requireTable(schema, name) {
        const table = this.tables.get(this.key(schema, name));
        if (!table) {
            throw FakebaseError.tableMissing(`${schema}.${name}`);
        }
        return table;
    }
    /** Return all registered tables. */
    getTables() {
        return [...this.tables.values()];
    }
    /** Return the enum IR or undefined when not found. */
    getEnum(schema, name) {
        return this.enums.get(this.key(schema, name));
    }
    /** Register a new table at runtime (e.g. after a migration). */
    addTable(table) {
        this.tables.set(this.key(table.schema, table.name), table);
        this.ir.tables.push(table);
    }
    /** Remove a table from the registry (e.g. after a DROP TABLE migration). */
    removeTable(schema, name) {
        this.tables.delete(this.key(schema, name));
        const idx = this.ir.tables.findIndex((t) => t.schema === schema && t.name === name);
        if (idx !== -1)
            this.ir.tables.splice(idx, 1);
    }
    /** Reconstruct the full project schema IR from the current registry state. */
    toIR() {
        return {
            ...this.ir,
            tables: [...this.tables.values()],
            enums: [...this.enums.values()],
        };
    }
}
//# sourceMappingURL=registry.js.map