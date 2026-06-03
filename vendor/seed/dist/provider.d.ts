/**
 * The data-provider boundary.
 *
 * A `DataProvider` supplies only *leaf value vocabulary* — single column values
 * keyed by type or by column name. Everything that makes generated data
 * *correct* (FK integrity, enums, unique/nullable handling, insert ordering)
 * lives in the engine, not here. This is what lets `@faker-js/faker` drop in as
 * an alternative provider without re-implementing the engine.
 */
import type { ColumnType } from "@fakebase/core";
/** A generator produces one column value per call. */
export type ValueGenerator = () => unknown;
export interface DataProvider {
    /** Reseed the provider's RNG so output is deterministic. */
    seed(n: number): void;
    /** A generator for a raw column type (the type fallback). */
    forType(type: ColumnType): ValueGenerator;
    /** A generator inferred from a column name, or `null` if no semantic match. */
    forName(name: string, type: ColumnType): ValueGenerator | null;
}
/**
 * Create the default, dependency-free data provider.
 */
export declare function createBuiltinProvider(): DataProvider;
//# sourceMappingURL=provider.d.ts.map