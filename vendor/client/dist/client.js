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
import { EventBus } from "@fakebase/core";
import { LocalAuthService, MemorySessionStorage } from "@fakebase/auth";
import { LocalStorageService } from "@fakebase/storage";
import { RealtimeService } from "@fakebase/realtime";
import { QueryBuilder } from "./query-builder.js";
/**
 * Minimal Supabase-compatible client backed by local Fakebase adapters.
 *
 * Usage:
 * ```ts
 * const { kernel } = createMemoryKernel<Database>();
 * const supabase = createClient<Database>("local", "dev-key", { kernel });
 * ```
 */
export class FakebaseClient {
    _url;
    _key;
    _adapterPromise;
    _schema;
    _authService;
    _storageService;
    _realtimeService = null;
    auth;
    storage;
    functions;
    constructor(_url, _key, options) {
        this._url = _url;
        this._key = _key;
        this._adapterPromise = options.kernel._adapter;
        this._schema = options.schema ?? "public";
        this._authService = new LocalAuthService(new Map(), new Map(), new MemorySessionStorage());
        this._storageService = new LocalStorageService(options.storagePath ?? ".fakebase/storage", new Map(), new Map(), new Map(), { baseUrl: options.storageUrl ?? "http://localhost:54321/storage/v1" });
        // Create realtime service backed by a simple event bus
        const bus = new EventBus();
        this._realtimeService = new RealtimeService(bus);
        // Expose auth
        this.auth = this._authService;
        // Expose storage with bucket factory
        const storageService = this._storageService;
        this.storage = {
            from: (bucket) => storageService.from(bucket),
            listBuckets: () => storageService.listBuckets(),
            createBucket: (id, opts) => storageService.createBucket(id, opts),
            deleteBucket: (id) => storageService.deleteBucket(id),
        };
        // Expose functions
        const adapterPromise = this._adapterPromise;
        this.functions = {
            invoke: async (functionName, options) => {
                try {
                    const adapter = await adapterPromise;
                    const result = await adapter.rpc(functionName, options?.body ?? {});
                    return { data: result, error: null };
                }
                catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    return { data: null, error: { message: msg } };
                }
            },
        };
    }
    /**
     * Start a query against a table. Returns a chainable QueryBuilder.
     *
     * ```ts
     * const { data } = await supabase.from('posts').select('*').eq('id', 1).single();
     * ```
     */
    from(table) {
        return new QueryBuilder(table, this._schema, this._adapterPromise);
    }
    /**
     * Create or retrieve a realtime channel.
     */
    channel(name) {
        if (!this._realtimeService) {
            throw new Error("Realtime service not initialized");
        }
        return this._realtimeService.channel(name);
    }
    /**
     * Remove a realtime channel.
     */
    removeChannel(channel) {
        if (!this._realtimeService) {
            return Promise.resolve("error");
        }
        return this._realtimeService.removeChannel(channel);
    }
    /**
     * Remove all realtime channels.
     */
    removeAllChannels() {
        if (!this._realtimeService) {
            return Promise.resolve([]);
        }
        return this._realtimeService.removeAllChannels();
    }
    /**
     * Get all active channels.
     */
    getChannels() {
        return this._realtimeService?.getChannels() ?? [];
    }
    /**
     * RPC — call a Postgres function.
     */
    async rpc(fn, params, options) {
        try {
            const adapter = await this._adapterPromise;
            const result = await adapter.rpc(fn, params ?? {});
            return { data: result, error: null };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { data: null, error: { message: msg } };
        }
    }
}
/**
 * Create a Fakebase client with the Supabase-compatible API.
 *
 * ```ts
 * const { kernel } = createMemoryKernel<Database>();
 * const supabase = createClient<Database>("local", "dev-key", { kernel });
 * ```
 */
export function createClient(url, key, options) {
    return new FakebaseClient(url, key, options);
}
//# sourceMappingURL=client.js.map