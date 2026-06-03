/**
 * Schema Registry — runtime lookup for tables, enums, and functions.
 * The registry is the single source of truth for schema metadata at runtime.
 */
import type { EnumIR, ProjectSchemaIR, TableIR } from "./ir.js";
export declare class SchemaRegistry {
    private readonly tables;
    private readonly enums;
    private readonly ir;
    constructor(schema: ProjectSchemaIR);
    private key;
    /** Return the table IR or undefined when not found. */
    getTable(schema: string, name: string): TableIR | undefined;
    /**
     * Return the table IR, throwing `FakebaseError.tableMissing` when absent.
     * Use this in hot paths where the table is expected to exist.
     */
    requireTable(schema: string, name: string): TableIR;
    /** Return all registered tables. */
    getTables(): TableIR[];
    /** Return the enum IR or undefined when not found. */
    getEnum(schema: string, name: string): EnumIR | undefined;
    /** Register a new table at runtime (e.g. after a migration). */
    addTable(table: TableIR): void;
    /** Remove a table from the registry (e.g. after a DROP TABLE migration). */
    removeTable(schema: string, name: string): void;
    /** Reconstruct the full project schema IR from the current registry state. */
    toIR(): ProjectSchemaIR;
}
//# sourceMappingURL=registry.d.ts.map