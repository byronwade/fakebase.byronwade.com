import type { ProjectSchemaIR, ColumnIR, ColumnType, TableIR } from "@byronwade/core";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GenerateTypesOptions {
  /** When true, generate Postgres enums as TypeScript union types instead of enum declarations. */
  enumsAsUnions?: boolean;
}

// ---------------------------------------------------------------------------
// IR → TypeScript type mapping
// ---------------------------------------------------------------------------

/** Map an IR column type to a TypeScript type string. */
function irTypeToTs(colType: ColumnType): string {
  switch (colType) {
    case "uuid":
    case "text":
    case "varchar":
    case "char":
    case "timestamptz":
    case "timestamp":
    case "date":
    case "time":
    case "bytea":
      return "string";

    case "int4":
    case "int8":
    case "float4":
    case "float8":
    case "numeric":
    case "serial":
      return "number";

    case "bool":
      return "boolean";

    case "jsonb":
    case "json":
      return "Json";

    default:
      // Handle array types like `text[]`
      if (colType.endsWith("[]")) {
        const base = irTypeToTs(colType.slice(0, -2) as ColumnType);
        return `${base}[]`;
      }
      return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Column type builders for Row / Insert / Update
// ---------------------------------------------------------------------------

/** TypeScript type for the Row shape: nullable columns become `T | null`. */
function rowType(col: ColumnIR): string {
  const base = irTypeToTs(col.type);
  return col.nullable ? `${base} | null` : base;
}

/**
 * TypeScript type for the Insert shape:
 * - generated columns → `never` (cannot be set by caller)
 * - columns with defaultSql → `T | undefined` (optional to provide)
 * - nullable columns → `T | null`
 * - required non-nullable columns → `T`
 */
function insertType(col: ColumnIR): string {
  if (col.generated) return "never";
  const base = irTypeToTs(col.type);
  if (col.nullable && col.defaultSql) return `${base} | null | undefined`;
  if (col.nullable) return `${base} | null`;
  if (col.defaultSql) return `${base} | undefined`;
  return base;
}

/** TypeScript type for the Update shape: every column is optional. */
function updateType(col: ColumnIR): string {
  const base = irTypeToTs(col.type);
  if (col.nullable) return `${base} | null | undefined`;
  return `${base} | undefined`;
}

// ---------------------------------------------------------------------------
// Relationship extraction
// ---------------------------------------------------------------------------

interface Relationship {
  foreignKeyName: string;
  columns: string[];
  referencedRelation: string;
  referencedColumns: string[];
}

function extractRelationships(table: TableIR): Relationship[] {
  const result: Relationship[] = [];
  for (const col of table.columns) {
    if (!col.references) continue;
    result.push({
      foreignKeyName: `${table.name}_${col.name}_fkey`,
      columns: [col.name],
      referencedRelation: col.references.table,
      referencedColumns: [col.references.column],
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

function indent(n: number): string {
  return "  ".repeat(n);
}

function renderRelationship(rel: Relationship): string {
  const cols = rel.columns.map((c) => `"${c}"`).join(", ");
  const refCols = rel.referencedColumns.map((c) => `"${c}"`).join(", ");
  return [
    `{`,
    `  foreignKeyName: "${rel.foreignKeyName}";`,
    `  columns: [${cols}];`,
    `  referencedRelation: "${rel.referencedRelation}";`,
    `  referencedColumns: [${refCols}];`,
    `}`,
  ].join(" ");
}

function renderTableType(table: TableIR): string {
  const lines: string[] = [];

  lines.push(`${indent(3)}${table.name}: {`);

  // Row type
  lines.push(`${indent(4)}Row: {`);
  for (const col of table.columns) {
    lines.push(`${indent(5)}${col.name}: ${rowType(col)};`);
  }
  lines.push(`${indent(4)}};`);

  // Insert type
  lines.push(`${indent(4)}Insert: {`);
  for (const col of table.columns) {
    const t = insertType(col);
    if (t === "never") {
      lines.push(`${indent(5)}${col.name}?: never;`);
    } else if (t.endsWith("| undefined")) {
      lines.push(`${indent(5)}${col.name}?: ${t.replace(" | undefined", "")};`);
    } else {
      lines.push(`${indent(5)}${col.name}: ${t};`);
    }
  }
  lines.push(`${indent(4)}};`);

  // Update type — all fields are optional
  lines.push(`${indent(4)}Update: {`);
  for (const col of table.columns) {
    const t = updateType(col);
    lines.push(`${indent(5)}${col.name}?: ${t.replace(" | undefined", "")};`);
  }
  lines.push(`${indent(4)}};`);

  // Relationships
  const rels = extractRelationships(table);
  lines.push(`${indent(4)}Relationships: [`);
  for (const rel of rels) {
    lines.push(`${indent(5)}${renderRelationship(rel)};`);
  }
  lines.push(`${indent(4)}];`);

  lines.push(`${indent(3)}};`);

  return lines.join("\n");
}

/**
 * Generate a `database.types.ts` string in Supabase format from a
 * `ProjectSchemaIR`.
 *
 * The output mirrors the type structure emitted by the Supabase CLI's
 * `supabase gen types typescript` command, making it a drop-in replacement
 * for projects that already consume that format.
 */
export function generateTypes(
  schema: ProjectSchemaIR,
  _options?: GenerateTypesOptions,
): string {
  const lines: string[] = [];

  lines.push("// Generated by @byronwade/types — do not edit manually.");
  lines.push("");
  lines.push(
    "export type Json =",
    "  | string",
    "  | number",
    "  | boolean",
    "  | null",
    "  | { [key: string]: Json | undefined }",
    "  | Json[];",
  );
  lines.push("");

  lines.push("export type Database = {");
  lines.push(`${indent(1)}public: {`);

  // Tables
  lines.push(`${indent(2)}Tables: {`);
  for (const table of schema.tables) {
    lines.push(renderTableType(table));
  }
  lines.push(`${indent(2)}};`);

  // Views (empty for now)
  lines.push(`${indent(2)}Views: {`);
  lines.push(`${indent(2)}};`);

  // Functions
  lines.push(`${indent(2)}Functions: {`);
  for (const fn of schema.functions) {
    lines.push(`${indent(3)}${fn.name}: {`);
    lines.push(`${indent(4)}Args: {`);
    for (const arg of fn.args) {
      lines.push(`${indent(5)}${arg.name}: ${irTypeToTs(arg.type as ColumnType)};`);
    }
    lines.push(`${indent(4)}};`);
    lines.push(`${indent(4)}Returns: ${irTypeToTs(fn.returnType as ColumnType)};`);
    lines.push(`${indent(3)}};`);
  }
  lines.push(`${indent(2)}};`);

  // Enums
  lines.push(`${indent(2)}Enums: {`);
  for (const e of schema.enums) {
    const vals = e.values.map((v) => `"${v}"`).join(" | ");
    lines.push(`${indent(3)}${e.name}: ${vals};`);
  }
  lines.push(`${indent(2)}};`);

  // CompositeTypes (empty)
  lines.push(`${indent(2)}CompositeTypes: {`);
  lines.push(`${indent(2)}};`);

  lines.push(`${indent(1)}};`);
  lines.push("};");
  lines.push("");

  // Convenience type helpers
  lines.push(
    "export type Tables<",
    `${indent(1)}T extends keyof Database["public"]["Tables"],`,
    `> = Database["public"]["Tables"][T]["Row"];`,
  );
  lines.push("");

  lines.push(
    "export type TablesInsert<",
    `${indent(1)}T extends keyof Database["public"]["Tables"],`,
    `> = Database["public"]["Tables"][T]["Insert"];`,
  );
  lines.push("");

  lines.push(
    "export type TablesUpdate<",
    `${indent(1)}T extends keyof Database["public"]["Tables"],`,
    `> = Database["public"]["Tables"][T]["Update"];`,
  );
  lines.push("");

  lines.push(
    "export type Enums<",
    `${indent(1)}T extends keyof Database["public"]["Enums"],`,
    `> = Database["public"]["Enums"][T];`,
  );
  lines.push("");

  return lines.join("\n");
}
