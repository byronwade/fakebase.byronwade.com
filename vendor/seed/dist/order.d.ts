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
export declare function orderTables(schema: ProjectSchemaIR): TableIR[];
//# sourceMappingURL=order.d.ts.map