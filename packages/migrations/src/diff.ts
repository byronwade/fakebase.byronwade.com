/**
 * Schema diff engine — compares two {@link ProjectSchemaIR} snapshots and
 * produces a structured {@link SchemaDiff}, plus a SQL renderer (`diffToSql`)
 * that emits the `create/alter/drop` statements needed to migrate `before`
 * into `after`.
 */

import type {
  ColumnIR,
  EnumIR,
  IndexIR,
  ProjectSchemaIR,
  TableIR,
} from "@byronwade/core";
import { mapIrTypeToSql } from "./export-sql-helpers.js";

/** A per-table set of changes between two schema snapshots. */
export interface TableModification {
  schema: string;
  name: string;
  /** The full (after) table definition. */
  table: TableIR;
  addedColumns: ColumnIR[];
  removedColumns: string[];
  /** Columns whose definition changed (after-image). */
  modifiedColumns: ColumnIR[];
  rlsChanged: boolean;
  addedIndexes: IndexIR[];
  removedIndexes: string[];
}

/** The structured difference between two schema snapshots. */
export interface SchemaDiff {
  addedTables: TableIR[];
  removedTables: TableIR[];
  modifiedTables: TableModification[];
  addedEnums: EnumIR[];
  removedEnums: EnumIR[];
}

function tableKey(t: { schema: string; name: string }): string {
  return `${t.schema}.${t.name}`;
}

function columnsEqual(a: ColumnIR, b: ColumnIR): boolean {
  return (
    a.type === b.type &&
    Boolean(a.nullable) === Boolean(b.nullable) &&
    Boolean(a.primaryKey) === Boolean(b.primaryKey) &&
    Boolean(a.unique) === Boolean(b.unique) &&
    (a.defaultSql ?? null) === (b.defaultSql ?? null)
  );
}

function diffTable(before: TableIR, after: TableIR): TableModification | null {
  const beforeCols = new Map(before.columns.map((c) => [c.name, c]));
  const afterCols = new Map(after.columns.map((c) => [c.name, c]));

  const addedColumns = after.columns.filter((c) => !beforeCols.has(c.name));
  const removedColumns = before.columns
    .filter((c) => !afterCols.has(c.name))
    .map((c) => c.name);
  const modifiedColumns = after.columns.filter((c) => {
    const prev = beforeCols.get(c.name);
    return prev !== undefined && !columnsEqual(prev, c);
  });

  const beforeIdx = new Map(before.indexes.map((i) => [i.name, i]));
  const afterIdx = new Map(after.indexes.map((i) => [i.name, i]));
  const addedIndexes = after.indexes.filter((i) => !beforeIdx.has(i.name));
  const removedIndexes = before.indexes
    .filter((i) => !afterIdx.has(i.name))
    .map((i) => i.name);

  const rlsChanged = Boolean(before.rlsEnabled) !== Boolean(after.rlsEnabled);

  if (
    addedColumns.length === 0 &&
    removedColumns.length === 0 &&
    modifiedColumns.length === 0 &&
    addedIndexes.length === 0 &&
    removedIndexes.length === 0 &&
    !rlsChanged
  ) {
    return null;
  }

  return {
    schema: after.schema,
    name: after.name,
    table: after,
    addedColumns,
    removedColumns,
    modifiedColumns,
    rlsChanged,
    addedIndexes,
    removedIndexes,
  };
}

/** Compute the structured diff between two schema snapshots. */
export function diffSchemas(
  before: ProjectSchemaIR,
  after: ProjectSchemaIR,
): SchemaDiff {
  const beforeTables = new Map(before.tables.map((t) => [tableKey(t), t]));
  const afterTables = new Map(after.tables.map((t) => [tableKey(t), t]));

  const addedTables = after.tables.filter((t) => !beforeTables.has(tableKey(t)));
  const removedTables = before.tables.filter((t) => !afterTables.has(tableKey(t)));

  const modifiedTables: TableModification[] = [];
  for (const [key, afterTable] of afterTables) {
    const beforeTable = beforeTables.get(key);
    if (!beforeTable) continue;
    const mod = diffTable(beforeTable, afterTable);
    if (mod) modifiedTables.push(mod);
  }

  const beforeEnums = new Map(before.enums.map((e) => [tableKey(e), e]));
  const afterEnums = new Map(after.enums.map((e) => [tableKey(e), e]));
  const addedEnums = after.enums.filter((e) => !beforeEnums.has(tableKey(e)));
  const removedEnums = before.enums.filter((e) => !afterEnums.has(tableKey(e)));

  return { addedTables, removedTables, modifiedTables, addedEnums, removedEnums };
}

/** True when the diff contains no changes at all. */
export function isSchemaDiffEmpty(diff: SchemaDiff): boolean {
  return (
    diff.addedTables.length === 0 &&
    diff.removedTables.length === 0 &&
    diff.modifiedTables.length === 0 &&
    diff.addedEnums.length === 0 &&
    diff.removedEnums.length === 0
  );
}

// ---------------------------------------------------------------------------
// SQL rendering
// ---------------------------------------------------------------------------

function columnSql(col: ColumnIR): string {
  const parts: string[] = [`"${col.name}" ${mapIrTypeToSql(col.type)}`];
  if (!col.nullable && !col.primaryKey) parts.push("not null");
  if (col.unique && !col.primaryKey) parts.push("unique");
  if (col.defaultSql) parts.push(`default ${col.defaultSql}`);
  if (col.references) {
    parts.push(`references "${col.references.table}"("${col.references.column}")`);
  }
  return parts.join(" ");
}

function createTableSql(table: TableIR): string {
  const lines = [`create table if not exists "${table.schema}"."${table.name}" (`];
  const colLines = table.columns.map((c) => `  ${columnSql(c)}`);
  const pkCols = table.columns.filter((c) => c.primaryKey).map((c) => `"${c.name}"`);
  if (pkCols.length > 0) colLines.push(`  primary key (${pkCols.join(", ")})`);
  lines.push(colLines.join(",\n"));
  lines.push(");");
  return lines.join("\n");
}

/** Render a schema diff as a SQL migration script (empty string when no diff). */
export function diffToSql(diff: SchemaDiff): string {
  const statements: string[] = [];

  for (const e of diff.addedEnums) {
    const values = e.values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
    statements.push(`create type "${e.schema}"."${e.name}" as enum (${values});`);
  }

  for (const table of diff.addedTables) {
    statements.push(createTableSql(table));
    for (const idx of table.indexes) {
      const unique = idx.unique ? "unique " : "";
      const cols = idx.columns.map((c) => `"${c}"`).join(", ");
      statements.push(
        `create ${unique}index if not exists "${idx.name}" on "${table.schema}"."${table.name}" (${cols});`,
      );
    }
  }

  for (const mod of diff.modifiedTables) {
    const ref = `"${mod.schema}"."${mod.name}"`;
    for (const col of mod.addedColumns) {
      statements.push(`alter table ${ref} add column ${columnSql(col)};`);
    }
    for (const colName of mod.removedColumns) {
      statements.push(`alter table ${ref} drop column "${colName}";`);
    }
    for (const col of mod.modifiedColumns) {
      statements.push(
        `alter table ${ref} alter column "${col.name}" type ${mapIrTypeToSql(col.type)};`,
      );
      statements.push(
        col.nullable
          ? `alter table ${ref} alter column "${col.name}" drop not null;`
          : `alter table ${ref} alter column "${col.name}" set not null;`,
      );
    }
    for (const idx of mod.addedIndexes) {
      const unique = idx.unique ? "unique " : "";
      const cols = idx.columns.map((c) => `"${c}"`).join(", ");
      statements.push(
        `create ${unique}index if not exists "${idx.name}" on ${ref} (${cols});`,
      );
    }
    for (const idxName of mod.removedIndexes) {
      statements.push(`drop index if exists "${idxName}";`);
    }
    if (mod.rlsChanged) {
      statements.push(
        mod.table.rlsEnabled
          ? `alter table ${ref} enable row level security;`
          : `alter table ${ref} disable row level security;`,
      );
    }
  }

  for (const table of diff.removedTables) {
    statements.push(`drop table if exists "${table.schema}"."${table.name}";`);
  }

  for (const e of diff.removedEnums) {
    statements.push(`drop type if exists "${e.schema}"."${e.name}";`);
  }

  return statements.join("\n\n");
}
