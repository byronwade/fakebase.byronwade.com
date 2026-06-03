/**
 * The generation engine: schema IR + a data provider -> rows.
 *
 * Everything that makes data *correct* lives here — primary-key uniqueness,
 * foreign-key referential integrity, enum validity, `unique`/`nullable`
 * handling, column skipping, and determinism. The provider only supplies leaf
 * values; this module decides what each column gets and in what order.
 */

import type {
  ColumnIR,
  EnumIR,
  ProjectSchemaIR,
  TableIR,
} from "@fakebase/core";
import { createBuiltinProvider, type DataProvider } from "./provider.js";
import { createRng } from "./rng.js";
import { orderTables } from "./order.js";

export type OverrideFn = (row: Record<string, unknown>) => unknown;

export interface GenerateOptions {
  /** Rows generated per table unless overridden in `tables`. Default 10. */
  rowsPerTable?: number;
  /** Per-table row-count overrides, keyed by table name. */
  tables?: Record<string, number>;
  /** RNG seed for deterministic output. Default 0. */
  seed?: number;
  /** Probability (0–1) that a nullable column is set to null. Default 0. */
  nullRate?: number;
  /** Leaf-value provider. Default: the built-in zero-dependency provider. */
  provider?: DataProvider;
  /**
   * Per-column generator overrides, keyed by `table.column` or
   * `schema.table.column`. Receives the partially-built row.
   */
  overrides?: Record<string, OverrideFn>;
}

export type GeneratedRows = Record<string, Record<string, unknown>[]>;

const INT_TYPES = new Set(["int4", "int8"]);
const UNIQUE_RETRY_LIMIT = 100;

function overrideFor(
  overrides: Record<string, OverrideFn> | undefined,
  table: TableIR,
  col: string,
): OverrideFn | undefined {
  if (!overrides) return undefined;
  return (
    overrides[`${table.schema}.${table.name}.${col}`] ??
    overrides[`${table.name}.${col}`]
  );
}

/**
 * Generate referentially-correct fake rows for every table in the schema.
 * Returns a map of `"schema.table"` -> rows (matching the kernel snapshot key
 * convention).
 */
export function generateRows(
  schema: ProjectSchemaIR,
  options: GenerateOptions = {},
): GeneratedRows {
  const {
    rowsPerTable = 10,
    tables = {},
    seed = 0,
    nullRate = 0,
    overrides,
  } = options;

  const provider = options.provider ?? createBuiltinProvider();
  provider.seed(seed);
  // A separate stream for engine-level decisions (null rolls, FK/enum picks)
  // so they stay deterministic and independent of provider value draws.
  const rng = createRng(seed ^ 0x9e3779b9);

  const enums = new Map<string, EnumIR>(schema.enums.map((e) => [e.name, e]));
  const result: GeneratedRows = {};
  // Primary-key values per table name, for FK referencing.
  const pkValues = new Map<string, unknown[]>();

  for (const table of orderTables(schema)) {
    const count = tables[table.name] ?? rowsPerTable;
    const pkName = table.primaryKey;
    const rows: Record<string, unknown>[] = [];
    const pks: unknown[] = [];
    // Per-column seen-sets for `unique` enforcement.
    const seen = new Map<string, Set<unknown>>();

    for (let i = 0; i < count; i++) {
      const row: Record<string, unknown> = {};

      for (const col of table.columns) {
        const value = resolveColumn({
          table,
          col,
          row,
          index: i,
          pkName,
          enums,
          provider,
          rng,
          nullRate,
          overrides,
          pkValues,
          seen,
        });
        if (value !== SKIP) row[col.name] = value;
      }

      rows.push(row);
      pks.push(row[pkName]);
    }

    result[`${table.schema}.${table.name}`] = rows;
    pkValues.set(table.name, pks);
  }

  return result;
}

/** Sentinel: column should be omitted from the row entirely. */
const SKIP = Symbol("skip");

interface ResolveCtx {
  table: TableIR;
  col: ColumnIR;
  row: Record<string, unknown>;
  index: number;
  pkName: string;
  enums: Map<string, EnumIR>;
  provider: DataProvider;
  rng: () => number;
  nullRate: number;
  overrides?: Record<string, OverrideFn>;
  pkValues: Map<string, unknown[]>;
  seen: Map<string, Set<unknown>>;
}

function resolveColumn(ctx: ResolveCtx): unknown {
  const { table, col, row, index, pkName, enums, provider, rng } = ctx;

  // 1. Explicit override wins over everything.
  const override = overrideFor(ctx.overrides, table, col.name);
  if (override) return override(row);

  // 2. Primary key: always generated and unique (so FKs can reference it).
  if (col.name === pkName || col.primaryKey) {
    return generateUnique(ctx, () =>
      INT_TYPES.has(col.type) ? index + 1 : provider.forType(col.type)(),
    );
  }

  // 3. Database-generated / defaulted columns are left for the DB to fill.
  if (col.generated || col.defaultSql !== undefined) return SKIP;

  // 4. Nullable columns may be null.
  if (col.nullable && ctx.nullRate > 0 && rng() < ctx.nullRate) return null;

  // 5. Foreign key -> reference an existing parent primary key.
  if (col.references) {
    const parent = ctx.pkValues.get(col.references.table);
    if (!parent || parent.length === 0) return col.nullable ? null : SKIP;
    return parent[Math.floor(rng() * parent.length)];
  }

  // 6. Enum -> pick a declared value.
  const en = enums.get(col.type);
  if (en && en.values.length > 0) {
    return en.values[Math.floor(rng() * en.values.length)];
  }

  // 7. Semantic name inference, then 8. raw type fallback. Both honor `unique`.
  const gen =
    provider.forName(col.name, col.type) ?? provider.forType(col.type);
  return generateUnique(ctx, gen);
}

/**
 * Run `gen`, retrying on collision when the column is `unique` (or a primary
 * key). After the retry budget is exhausted the last value is accepted.
 */
function generateUnique(ctx: ResolveCtx, gen: () => unknown): unknown {
  const { col } = ctx;
  if (!col.unique && col.name !== ctx.pkName && !col.primaryKey) return gen();

  let set = ctx.seen.get(col.name);
  if (!set) {
    set = new Set();
    ctx.seen.set(col.name, set);
  }

  let value = gen();
  for (let attempt = 0; attempt < UNIQUE_RETRY_LIMIT && set.has(value); attempt++) {
    value = gen();
  }
  set.add(value);
  return value;
}
