/**
 * Honest generation: describe how every column *would* be resolved, without
 * generating data. Powers the CLI `--report` flag and runtime debugging so no
 * column is silently mis-generated — a fall-through to a raw type default is
 * visible, not hidden.
 */

import type { ProjectSchemaIR } from "@byronwade/core";
import { createBuiltinProvider, type DataProvider } from "./provider.js";
import type { OverrideFn } from "./generate.js";

export type ResolutionStrategy =
  | "override"
  | "primary-key"
  | "skipped"
  | "foreign-key"
  | "enum"
  | "semantic"
  | "type";

export interface ColumnResolution {
  table: string;
  column: string;
  strategy: ResolutionStrategy;
  /** Extra context, e.g. the referenced table or enum name. */
  detail?: string;
}

export interface DescribeOptions {
  provider?: DataProvider;
  overrides?: Record<string, OverrideFn>;
}

/**
 * Classify each column's generation strategy, mirroring the engine's
 * resolution priority order.
 */
export function describeResolution(
  schema: ProjectSchemaIR,
  options: DescribeOptions = {},
): ColumnResolution[] {
  const provider = options.provider ?? createBuiltinProvider();
  const enumNames = new Set(schema.enums.map((e) => e.name));
  const out: ColumnResolution[] = [];

  for (const table of schema.tables) {
    for (const col of table.columns) {
      const hasOverride =
        options.overrides &&
        (options.overrides[`${table.schema}.${table.name}.${col.name}`] !==
          undefined ||
          options.overrides[`${table.name}.${col.name}`] !== undefined);

      let strategy: ResolutionStrategy;
      let detail: string | undefined;

      if (hasOverride) {
        strategy = "override";
      } else if (col.name === table.primaryKey || col.primaryKey) {
        strategy = "primary-key";
      } else if (col.generated || col.defaultSql !== undefined) {
        strategy = "skipped";
        detail = col.generated ? "generated" : `default ${col.defaultSql}`;
      } else if (col.references) {
        strategy = "foreign-key";
        detail = `→ ${col.references.table}.${col.references.column}`;
      } else if (enumNames.has(col.type)) {
        strategy = "enum";
        detail = col.type;
      } else if (provider.forName(col.name, col.type)) {
        strategy = "semantic";
      } else {
        strategy = "type";
        detail = col.type;
      }

      out.push({ table: table.name, column: col.name, strategy, detail });
    }
  }

  return out;
}
