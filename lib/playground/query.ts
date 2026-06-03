/**
 * Constrained query spec for the playground's query console. The console never
 * evaluates arbitrary code — the user assembles a whitelisted spec (table +
 * columns + optional eq / order / limit) which a Server Action validates against
 * `playgroundSchema` before running it on the visitor's kernel.
 */
import type { ProjectSchemaIR } from "@byronwade/fakebase";

export type QuerySpec = {
  table: string;
  /** "*" or a comma-separated column list. */
  columns: string;
  filterColumn?: string;
  filterValue?: string;
  orderColumn?: string;
  ascending?: boolean;
  limit?: number;
};

export const DEFAULT_SPEC: QuerySpec = {
  table: "posts",
  columns: "*",
  orderColumn: "created_at",
  ascending: false,
  limit: 20,
};

/** Column names for a table, or [] when the table is unknown. */
export function columnsFor(schema: ProjectSchemaIR, table: string): string[] {
  return schema.tables.find((t) => t.name === table)?.columns.map((c) => c.name) ?? [];
}

/** Drop anything not present in the schema so the runner only sees safe input. */
export function sanitizeSpec(schema: ProjectSchemaIR, spec: QuerySpec): QuerySpec | null {
  const table = schema.tables.find((t) => t.name === spec.table);
  if (!table) return null;
  const cols = new Set(table.columns.map((c) => c.name));

  const requested =
    spec.columns.trim() === "*" || spec.columns.trim() === ""
      ? "*"
      : spec.columns
          .split(",")
          .map((c) => c.trim())
          .filter((c) => cols.has(c))
          .join(", ") || "*";

  const clean: QuerySpec = { table: spec.table, columns: requested };
  if (spec.filterColumn && cols.has(spec.filterColumn) && spec.filterValue) {
    clean.filterColumn = spec.filterColumn;
    clean.filterValue = spec.filterValue;
  }
  if (spec.orderColumn && cols.has(spec.orderColumn)) {
    clean.orderColumn = spec.orderColumn;
    clean.ascending = Boolean(spec.ascending);
  }
  if (typeof spec.limit === "number" && spec.limit > 0) {
    clean.limit = Math.min(spec.limit, 100);
  }
  return clean;
}

/** The `@supabase/supabase-js`-shaped source for a spec, shown above the result. */
export function buildQueryCode(spec: QuerySpec): string {
  let code = `const { data, error } = await supabase\n  .from(${JSON.stringify(spec.table)})\n  .select(${JSON.stringify(spec.columns)})`;
  if (spec.filterColumn && spec.filterValue !== undefined) {
    code += `\n  .eq(${JSON.stringify(spec.filterColumn)}, ${JSON.stringify(spec.filterValue)})`;
  }
  if (spec.orderColumn) {
    code += `\n  .order(${JSON.stringify(spec.orderColumn)}, { ascending: ${Boolean(spec.ascending)} })`;
  }
  if (spec.limit) {
    code += `\n  .limit(${spec.limit})`;
  }
  return code + ";";
}
