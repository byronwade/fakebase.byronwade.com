/**
 * Runtime entry point: generate rows and insert them through a Supabase-shaped
 * client, in foreign-key-safe order. Idempotent — tables that already contain
 * rows are skipped, so it is safe to call on every boot.
 */
import type { ProjectSchemaIR } from "@fakebase/core";
import { type GenerateOptions } from "./generate.js";
/** The minimal slice of a Fakebase/Supabase client that seeding needs. */
interface SeedQuery {
    select(columns: string): {
        limit(n: number): PromiseLike<{
            data: unknown[] | null;
            error: unknown;
        }>;
    };
    insert(rows: Record<string, unknown>[]): PromiseLike<{
        error: unknown;
    }>;
}
export interface SeedableClient {
    from(table: string): SeedQuery;
    schema(name: string): {
        from(table: string): SeedQuery;
    };
}
export interface SeedClientOptions extends GenerateOptions {
    /**
     * Insert into tables even if they already contain rows. Default false
     * (idempotent — existing data is left untouched).
     */
    force?: boolean;
}
export interface SeedResult {
    /** Rows inserted, keyed by table name. */
    inserted: Record<string, number>;
    /** Tables skipped because they already had rows. */
    skipped: string[];
}
export declare function seedClient(client: SeedableClient, schema: ProjectSchemaIR, options?: SeedClientOptions): Promise<SeedResult>;
export {};
//# sourceMappingURL=seedClient.d.ts.map