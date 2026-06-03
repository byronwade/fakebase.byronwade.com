/**
 * FakebaseClient — Supabase-compatible client for local development.
 *
 * Wraps the Fakebase kernel with the @supabase/supabase-js API surface:
 * - from() query builder
 * - auth
 * - storage
 * - channel() realtime
 * - functions.invoke()
 */
import type { FakebaseAdapter } from "@fakebase/core";
import { LocalAuthService } from "@fakebase/auth";
import { LocalStorageService } from "@fakebase/storage";
import type { RealtimeChannel } from "@fakebase/realtime";
import { QueryBuilder } from "./query-builder.js";
export interface KernelHandle {
    _adapter: Promise<FakebaseAdapter>;
}
export interface FakebaseClientOptions {
    /** A kernel handle produced by createMemoryKernel or another factory. */
    kernel: KernelHandle;
    /** Schema name (default: "public") */
    schema?: string;
    /** Base URL for storage public URLs (default: "http://localhost:3000") */
    storageUrl?: string;
    /** Local filesystem path for file storage (default: ".fakebase/storage") */
    storagePath?: string;
}
/**
 * Minimal Supabase-compatible client backed by local Fakebase adapters.
 *
 * Usage:
 * ```ts
 * const { kernel } = createMemoryKernel<Database>();
 * const supabase = createClient<Database>("local", "dev-key", { kernel });
 * ```
 */
export declare class FakebaseClient<Database = unknown> {
    private readonly _url;
    private readonly _key;
    private readonly _adapterPromise;
    private readonly _schema;
    private readonly _authService;
    private readonly _storageService;
    private readonly _realtimeService;
    readonly auth: LocalAuthService;
    readonly storage: {
        from: (bucket: string) => ReturnType<LocalStorageService["from"]>;
        listBuckets: () => ReturnType<LocalStorageService["listBuckets"]>;
        createBucket: LocalStorageService["createBucket"];
        deleteBucket: LocalStorageService["deleteBucket"];
    };
    readonly functions: {
        invoke: <T = unknown>(functionName: string, options?: {
            body?: unknown;
            headers?: Record<string, string>;
        }) => Promise<{
            data: T | null;
            error: {
                message: string;
            } | null;
        }>;
    };
    constructor(_url: string, _key: string, options: FakebaseClientOptions);
    /**
     * Start a query against a table. Returns a chainable QueryBuilder.
     *
     * ```ts
     * const { data } = await supabase.from('posts').select('*').eq('id', 1).single();
     * ```
     */
    from<TableName extends string>(table: TableName): QueryBuilder<TableName extends keyof Database ? Database[TableName] extends {
        Row: infer R;
    } ? R extends Record<string, unknown> ? R : Record<string, unknown> : Record<string, unknown> : Record<string, unknown>>;
    /**
     * Create or retrieve a realtime channel.
     */
    channel(name: string): RealtimeChannel;
    /**
     * Remove a realtime channel.
     */
    removeChannel(channel: RealtimeChannel): Promise<"ok" | "error" | "timed out">;
    /**
     * Remove all realtime channels.
     */
    removeAllChannels(): Promise<("ok" | "error" | "timed out")[]>;
    /**
     * Get all active channels.
     */
    getChannels(): RealtimeChannel[];
    /**
     * RPC — call a Postgres function.
     */
    rpc<T = unknown>(fn: string, params?: Record<string, unknown>, options?: {
        count?: "exact" | "planned" | "estimated";
    }): Promise<{
        data: T | null;
        error: {
            message: string;
        } | null;
    }>;
}
/**
 * Create a Fakebase client with the Supabase-compatible API.
 *
 * ```ts
 * const { kernel } = createMemoryKernel<Database>();
 * const supabase = createClient<Database>("local", "dev-key", { kernel });
 * ```
 */
export declare function createClient<Database = unknown>(url: string, key: string, options: FakebaseClientOptions): FakebaseClient<Database>;
//# sourceMappingURL=client.d.ts.map