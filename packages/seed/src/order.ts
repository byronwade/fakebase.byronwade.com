/**
 * Topological ordering of tables by foreign-key dependency, so parents are
 * inserted before the children that reference them.
 */

import type { ProjectSchemaIR, TableIR } from "@fakebase/core";

/**
 * Order tables so that every table appears after the tables it references via
 * a foreign key. Self-references are ignored (a table never blocks itself).
 * Reference cycles are tolerated: once no further progress can be made, the
 * remaining tables are emitted in their original order (the engine fills their
 * nullable FKs with `null` on insert).
 */
export function orderTables(schema: ProjectSchemaIR): TableIR[] {
  const byName = new Map(schema.tables.map((t) => [t.name, t]));

  // Dependencies: table name -> set of referenced table names (excluding self
  // and references to tables not present in the schema).
  const deps = new Map<string, Set<string>>();
  for (const t of schema.tables) {
    const set = new Set<string>();
    for (const col of t.columns) {
      const ref = col.references?.table;
      if (ref && ref !== t.name && byName.has(ref)) set.add(ref);
    }
    deps.set(t.name, set);
  }

  const ordered: TableIR[] = [];
  const placed = new Set<string>();
  const remaining = schema.tables.map((t) => t.name);

  while (remaining.length > 0) {
    // Find tables whose dependencies are all already placed.
    const ready = remaining.filter((name) =>
      [...deps.get(name)!].every((d) => placed.has(d)),
    );

    const batch = ready.length > 0 ? ready : [remaining[0]!]; // break cycles

    for (const name of batch) {
      ordered.push(byName.get(name)!);
      placed.add(name);
      remaining.splice(remaining.indexOf(name), 1);
    }
  }

  return ordered;
}
