/**
 * Schema Registry — runtime lookup for tables, enums, and functions.
 * The registry is the single source of truth for schema metadata at runtime.
 */

import { FakebaseError } from "../errors.js";
import type { EnumIR, ProjectSchemaIR, TableIR } from "./ir.js";

export class SchemaRegistry {
  private readonly tables = new Map<string, TableIR>();
  private readonly enums = new Map<string, EnumIR>();
  private readonly ir: ProjectSchemaIR;

  constructor(schema: ProjectSchemaIR) {
    this.ir = { ...schema, tables: [...schema.tables], enums: [...schema.enums] };
    for (const table of schema.tables) {
      this.tables.set(this.key(table.schema, table.name), table);
    }
    for (const e of schema.enums) {
      this.enums.set(this.key(e.schema, e.name), e);
    }
  }

  private key(schema: string, name: string): string {
    return `${schema}.${name}`;
  }

  /** Return the table IR or undefined when not found. */
  getTable(schema: string, name: string): TableIR | undefined {
    return this.tables.get(this.key(schema, name));
  }

  /**
   * Return the table IR, throwing `FakebaseError.tableMissing` when absent.
   * Use this in hot paths where the table is expected to exist.
   */
  requireTable(schema: string, name: string): TableIR {
    const table = this.tables.get(this.key(schema, name));
    if (!table) {
      throw FakebaseError.tableMissing(`${schema}.${name}`);
    }
    return table;
  }

  /** Return all registered tables. */
  getTables(): TableIR[] {
    return [...this.tables.values()];
  }

  /** Return the enum IR or undefined when not found. */
  getEnum(schema: string, name: string): EnumIR | undefined {
    return this.enums.get(this.key(schema, name));
  }

  /** Register a new table at runtime (e.g. after a migration). */
  addTable(table: TableIR): void {
    this.tables.set(this.key(table.schema, table.name), table);
    this.ir.tables.push(table);
  }

  /** Remove a table from the registry (e.g. after a DROP TABLE migration). */
  removeTable(schema: string, name: string): void {
    this.tables.delete(this.key(schema, name));
    const idx = this.ir.tables.findIndex((t) => t.schema === schema && t.name === name);
    if (idx !== -1) this.ir.tables.splice(idx, 1);
  }

  /** Reconstruct the full project schema IR from the current registry state. */
  toIR(): ProjectSchemaIR {
    return {
      ...this.ir,
      tables: [...this.tables.values()],
      enums: [...this.enums.values()],
    };
  }
}
