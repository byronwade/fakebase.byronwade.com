/**
 * Honest generation: describe how every column *would* be resolved, without
 * generating data. Powers the CLI `--report` flag and runtime debugging so no
 * column is silently mis-generated — a fall-through to a raw type default is
 * visible, not hidden.
 */
import type { ProjectSchemaIR } from "@fakebase/core";
import { type DataProvider } from "./provider.js";
import type { OverrideFn } from "./generate.js";
export type ResolutionStrategy = "override" | "primary-key" | "skipped" | "foreign-key" | "enum" | "semantic" | "type";
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
export declare function describeResolution(schema: ProjectSchemaIR, options?: DescribeOptions): ColumnResolution[];
//# sourceMappingURL=report.d.ts.map