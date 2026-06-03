import type { ProjectSchemaIR, TableIR, ColumnIR, PolicyIR } from "@byronwade/core";

import { mapIrTypeToSql } from "./export-sql-helpers.js";

export interface ExportSqlOptions {
  includeRls?: boolean;
  includeGrants?: boolean;
  includeSeed?: boolean;
  schemaName?: string;
}

/** Alias so local code can call the shared helper with a shorter name. */
const mapIrType = mapIrTypeToSql;

/** Build a single column definition line (without trailing comma). */
function columnDef(col: ColumnIR): string {
  const parts: string[] = [`  "${col.name}" ${mapIrType(col.type)}`];

  if (!col.nullable && !col.primaryKey) parts.push("not null");
  if (col.unique && !col.primaryKey) parts.push("unique");
  if (col.defaultSql) parts.push(`default ${col.defaultSql}`);
  if (col.references) {
    parts.push(`references "${col.references.table}"("${col.references.column}")`);
  }

  return parts.join(" ");
}

/** Build the CREATE TABLE statement for a single table. */
function buildCreateTable(table: TableIR): string {
  const lines: string[] = [];
  lines.push(`create table if not exists "${table.schema}"."${table.name}" (`);

  const colLines = table.columns.map((c) => columnDef(c));

  const pkCols = table.columns.filter((c) => c.primaryKey).map((c) => `"${c.name}"`);
  if (pkCols.length > 0) {
    colLines.push(`  primary key (${pkCols.join(", ")})`);
  }

  lines.push(colLines.join(",\n"));
  lines.push(");");
  return lines.join("\n");
}

/** Build a CREATE POLICY statement. */
function buildPolicy(policy: PolicyIR): string {
  const parts: string[] = [
    `create policy "${policy.name}"`,
    `  on "${policy.schema}"."${policy.table}"`,
    `  as ${policy.permissive ? "permissive" : "restrictive"}`,
    `  for ${policy.command.toLowerCase()}`,
  ];

  if (policy.roles.length > 0) {
    parts.push(`  to ${policy.roles.join(", ")}`);
  }

  if (policy.using) {
    parts.push(`  using ( ${policy.using} )`);
  }

  if (policy.withCheck) {
    parts.push(`  with check ( ${policy.withCheck} )`);
  }

  return parts.join("\n") + ";";
}

/**
 * Topological sort of tables respecting foreign-key dependencies.
 * Tables with no dependencies come first; tables that reference others come after.
 */
function topologicalSort(tables: TableIR[]): TableIR[] {
  const byKey = new Map<string, TableIR>();
  for (const t of tables) {
    byKey.set(`${t.schema}.${t.name}`, t);
  }

  const visited = new Set<string>();
  const result: TableIR[] = [];

  function visit(table: TableIR): void {
    const k = `${table.schema}.${table.name}`;
    if (visited.has(k)) return;
    visited.add(k);

    for (const col of table.columns) {
      if (col.references) {
        const refKey = `${table.schema}.${col.references.table}`;
        const refTable =
          byKey.get(refKey) ?? byKey.get(`public.${col.references.table}`);
        if (refTable && refTable !== table) visit(refTable);
      }
    }

    result.push(table);
  }

  for (const table of tables) {
    visit(table);
  }

  return result;
}

/**
 * Generate a complete Supabase-compatible SQL migration from a ProjectSchemaIR.
 *
 * Output order:
 * 1. Header comment with generation timestamp
 * 2. `create schema if not exists` for non-public schemas
 * 3. `create table` statements in topological order
 * 4. `create index` statements
 * 5. RLS enablement + policy creation (when includeRls is true)
 * 6. Schema/table grants (when includeGrants is true)
 * 7. Footer verification comment
 */
export function exportSupabaseSql(
  schema: ProjectSchemaIR,
  options?: ExportSqlOptions,
): string {
  const { includeRls = true, includeGrants = true } = options ?? {};

  const lines: string[] = [];

  lines.push("-- Fakebase generated migration");
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push("");

  const namespaces = new Set<string>();
  for (const table of schema.tables) {
    namespaces.add(table.schema);
  }

  for (const ns of namespaces) {
    if (ns !== "public") {
      lines.push(`create schema if not exists "${ns}";`);
    }
  }
  if ([...namespaces].some((ns) => ns !== "public")) {
    lines.push("");
  }

  const sorted = topologicalSort(schema.tables);

  for (const table of sorted) {
    lines.push(buildCreateTable(table));
    lines.push("");
  }

  const hasIndexes = sorted.some((t) => t.indexes.length > 0);
  if (hasIndexes) {
    for (const table of sorted) {
      for (const idx of table.indexes) {
        const unique = idx.unique ? "unique " : "";
        const cols = idx.columns.map((c) => `"${c}"`).join(", ");
        lines.push(
          `create ${unique}index if not exists "${idx.name}" on "${table.schema}"."${table.name}" (${cols});`,
        );
      }
    }
    lines.push("");
  }

  if (includeRls) {
    const rlsTables = sorted.filter((t) => t.rlsEnabled);
    if (rlsTables.length > 0) {
      for (const table of rlsTables) {
        lines.push(
          `alter table "${table.schema}"."${table.name}" enable row level security;`,
        );
      }
      lines.push("");

      for (const table of rlsTables) {
        for (const policy of table.policies) {
          lines.push(buildPolicy(policy));
          lines.push("");
        }
      }
    }
  }

  if (includeGrants) {
    for (const ns of namespaces) {
      lines.push(`grant usage on schema "${ns}" to anon, authenticated;`);
    }
    lines.push("");
    for (const table of sorted) {
      lines.push(
        `grant select, insert, update, delete on "${table.schema}"."${table.name}" to anon, authenticated;`,
      );
    }
    lines.push("");
  }

  lines.push(
    "-- Migration complete. Verify the above SQL before applying to production.",
  );

  return lines.join("\n");
}

/**
 * Generate INSERT statements for seeding tables with test or initial data.
 *
 * @param schema     The schema IR (used to determine column order).
 * @param rows       Map of table name → array of row objects.
 */
export function exportSeedSql(
  schema: ProjectSchemaIR,
  rows: Record<string, Record<string, unknown>[]>,
  options: { timestamp?: boolean } = {},
): string {
  const lines: string[] = [];
  lines.push("-- Fakebase seed data");
  // The timestamp is opt-out so generated seed files can be byte-stable across
  // runs (clean git diffs). Defaults to included for backward compatibility.
  if (options.timestamp !== false) {
    lines.push(`-- Generated: ${new Date().toISOString()}`);
  }
  lines.push("");

  for (const [tableName, tableRows] of Object.entries(rows)) {
    if (tableRows.length === 0) continue;

    const tableIr = schema.tables.find((t) => t.name === tableName);
    const colOrder = tableIr
      ? tableIr.columns.map((c) => c.name)
      : Object.keys(tableRows[0] ?? {});

    const actualCols = colOrder.filter((c) => tableRows.some((r) => c in r));

    lines.push(`-- ${tableName}`);
    lines.push(
      `insert into "public"."${tableName}" (${actualCols.map((c) => `"${c}"`).join(", ")}) values`,
    );

    const valueRows = tableRows.map((row) => {
      const vals = actualCols.map((col) => {
        const v = row[col];
        if (v === null || v === undefined) return "null";
        if (typeof v === "boolean") return v ? "true" : "false";
        if (typeof v === "number") return String(v);
        if (typeof v === "object")
          return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      return `  (${vals.join(", ")})`;
    });

    lines.push(valueRows.join(",\n") + ";");
    lines.push("");
  }

  return lines.join("\n");
}
