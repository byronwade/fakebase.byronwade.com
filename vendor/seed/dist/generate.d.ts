/**
 * The generation engine: schema IR + a data provider -> rows.
 *
 * Everything that makes data *correct* lives here — primary-key uniqueness,
 * foreign-key referential integrity, enum validity, `unique`/`nullable`
 * handling, column skipping, and determinism. The provider only supplies leaf
 * values; this module decides what each column gets and in what order.
 */
import type { ProjectSchemaIR } from "@fakebase/core";
import { type DataProvider } from "./provider.js";
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
/**
 * Generate referentially-correct fake rows for every table in the schema.
 * Returns a map of `"schema.table"` -> rows (matching the kernel snapshot key
 * convention).
 */
export declare function generateRows(schema: ProjectSchemaIR, options?: GenerateOptions): GeneratedRows;
//# sourceMappingURL=generate.d.ts.map