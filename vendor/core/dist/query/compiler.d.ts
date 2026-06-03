/**
 * Query compiler — applies filters, ordering, pagination, and projection
 * to an in-memory row array and returns a Supabase-shaped result envelope.
 */
import { FakebaseError } from "../errors.js";
import { type Filter } from "./filter.js";
/** Configuration for a compiled query. */
export interface QueryOptions {
    table: string;
    schema: string;
    /** Column names to include in output (undefined = all columns). */
    select?: string[];
    filters: Filter[];
    orderBy?: {
        column: string;
        ascending: boolean;
        nullsFirst?: boolean;
    }[];
    limit?: number;
    offset?: number;
    count?: "exact" | "planned" | "estimated";
}
/** Standard result envelope returned by all adapter operations. */
export interface QueryResult<T> {
    data: T[] | null;
    error: FakebaseError | null;
    count: number | null;
    status: number;
    statusText: string;
}
/**
 * Apply all query options to an array of rows and return the Supabase-shaped
 * result envelope. This is the core "execution engine" for all in-memory
 * adapters.
 */
export declare function compileQuery<T extends Record<string, unknown>>(options: QueryOptions, rows: T[]): QueryResult<T>;
//# sourceMappingURL=compiler.d.ts.map