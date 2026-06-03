/**
 * PostgREST embedded resources: `select=*,author(*)`.
 *
 * Resolves a single level of foreign-key embedding against the schema registry,
 * using `kernel.query` for the related-table reads. Forward FKs (many-to-one)
 * embed a single object; reverse FKs (one-to-many) embed an array.
 */
import type { QueryPlan, SchemaRegistry, TableIR } from "@byronwade/core";

export interface Embed {
  name: string;
  columns: string[] | undefined; // undefined = all columns (`*`)
}

export interface ParsedSelect {
  columns: string[] | undefined; // base columns; undefined = all
  embeds: Embed[];
}

/** Split a select string on top-level commas (ignoring commas inside parens). */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

export function parseSelect(raw: string): ParsedSelect {
  const columns: string[] = [];
  const embeds: Embed[] = [];
  let all = false;
  for (const token of splitTopLevel(raw).map((t) => t.trim())) {
    if (!token) continue;
    const m = /^([A-Za-z_][\w]*)\((.*)\)$/.exec(token);
    if (m) {
      const inner = m[2]!.trim();
      embeds.push({ name: m[1]!, columns: inner === "*" || inner === "" ? undefined : inner.split(",").map((c) => c.trim()) });
    } else if (token === "*") {
      all = true;
    } else {
      columns.push(token);
    }
  }
  return { columns: all || columns.length === 0 ? undefined : columns, embeds };
}

type QueryFn = (plan: QueryPlan) => Promise<{ rows: Record<string, unknown>[] }>;

function fkColumn(from: TableIR, toTable: string): { column: string; refColumn: string } | null {
  for (const c of from.columns) {
    if (c.references?.table === toTable) {
      return { column: c.name, refColumn: c.references.column };
    }
  }
  return null;
}

/** Resolve embeds in place, nesting related rows under each embed's name. */
export async function resolveEmbeds(
  rows: Record<string, unknown>[],
  embeds: Embed[],
  schema: string,
  baseTableName: string,
  registry: SchemaRegistry,
  query: QueryFn,
): Promise<void> {
  if (rows.length === 0 || embeds.length === 0) return;
  const base = registry.getTable(schema, baseTableName);
  if (!base) return;

  for (const embed of embeds) {
    const target = registry.getTable(schema, embed.name);
    if (!target) continue;

    const forward = fkColumn(base, embed.name); // base → target (many-to-one)
    const reverse = fkColumn(target, baseTableName); // target → base (one-to-many)

    if (forward) {
      const ids = [...new Set(rows.map((r) => r[forward.column]).filter((v) => v != null))];
      const related = ids.length
        ? (await query(selectIn(schema, target, forward.refColumn, ids))).rows
        : [];
      const byKey = new Map(related.map((r) => [r[forward.refColumn], r]));
      for (const row of rows) {
        const hit = byKey.get(row[forward.column]);
        row[embed.name] = hit ? project(hit, embed.columns) : null;
      }
    } else if (reverse) {
      const basePk = base.primaryKey;
      const keys = [...new Set(rows.map((r) => r[basePk]).filter((v) => v != null))];
      const related = keys.length
        ? (await query(selectIn(schema, target, reverse.column, keys))).rows
        : [];
      const grouped = new Map<unknown, Record<string, unknown>[]>();
      for (const r of related) {
        const k = r[reverse.column];
        (grouped.get(k) ?? grouped.set(k, []).get(k)!).push(project(r, embed.columns));
      }
      for (const row of rows) row[embed.name] = grouped.get(row[basePk]) ?? [];
    } else {
      for (const row of rows) row[embed.name] = [];
    }
  }
}

/** Trim a related row to the requested embed columns (or keep all). */
function project(row: Record<string, unknown>, columns: string[] | undefined): Record<string, unknown> {
  if (!columns) return row;
  return Object.fromEntries(Object.entries(row).filter(([k]) => columns.includes(k)));
}

function selectIn(schema: string, target: TableIR, column: string, values: unknown[]): QueryPlan {
  return {
    schema,
    table: target.name,
    operation: "select",
    filters: [{ type: "simple", column, operator: "in", value: values }],
    select: undefined, // fetch all so join keys are present; project on assignment
    orderBy: [],
  };
}
