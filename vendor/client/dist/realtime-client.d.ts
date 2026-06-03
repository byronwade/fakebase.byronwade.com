/**
 * Realtime client facade — provides the `supabase.channel()` surface
 * on top of the kernel's minimal `RealtimeEngine` pub/sub interface.
 */
import type { FakebaseKernel, RealtimeEngine, RealtimePostgresCallback, RealtimeBroadcastCallback, RealtimePresenceCallback } from "@fakebase/core";
type PostgresFilter = {
    event: "*" | "INSERT" | "UPDATE" | "DELETE";
    schema?: string;
    table?: string;
    filter?: string;
};
type BroadcastFilter = {
    event: string;
};
type PresenceFilter = {
    event: "sync" | "join" | "leave";
};
type ChannelStatus = "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED";
/**
 * A realtime channel — mirrors `supabase.channel(name)`.
 */
export declare class Channel {
    readonly name: string;
    readonly topic: string;
    private readonly engine;
    private readonly unsubs;
    private status;
    private readonly broadcastListeners;
    private readonly presenceListeners;
    constructor(name: string, engine: RealtimeEngine);
    /**
     * Subscribe to Postgres change events.
     */
    on(type: "postgres_changes", filter: PostgresFilter, callback: RealtimePostgresCallback): this;
    /**
     * Subscribe to broadcast events.
     */
    on(type: "broadcast", filter: BroadcastFilter, callback: RealtimeBroadcastCallback): this;
    /**
     * Subscribe to presence events.
     */
    on(type: "presence", filter: PresenceFilter, callback: RealtimePresenceCallback): this;
    /**
     * Activate the channel subscriptions.
     *
     * @param callback - Optional status callback invoked when subscription state changes.
     */
    subscribe(callback?: (status: ChannelStatus, err?: Error) => void): this;
    /** Deactivate the channel, removing all kernel subscriptions. */
    unsubscribe(): Promise<"ok" | "timed out" | "error">;
    /**
     * Broadcast a message on this channel.
     *
     * In the memory kernel, broadcast listeners registered on the same channel
     * object are called synchronously. Remote broadcast (across processes) is
     * not supported by the in-memory adapter.
     */
    send(payload: {
        type: string;
        event: string;
        payload?: Record<string, unknown>;
    }): Promise<"ok" | "error" | "rate limited">;
    /** Current subscription status. */
    getStatus(): ChannelStatus;
}
/**
 * The `supabase.realtime` / `supabase.channel()` facade.
 * Mirrors the Supabase Realtime client API.
 */
export interface RealtimeClientFacade {
    /**
     * Create (or reuse) a named channel.
     */
    channel(name: string, options?: Record<string, unknown>): Channel;
    /** Return all active channels. */
    getChannels(): Channel[];
    /** Unsubscribe and remove a channel. */
    removeChannel(channel: Channel): Promise<"error" | "timed out" | "ok">;
    /** Unsubscribe and remove all channels. */
    removeAllChannels(): Promise<("error" | "timed out" | "ok")[]>;
}
/** Return type of `createRealtimeClient`. */
export type { RealtimeClientFacade as RealtimeClient };
/**
 * Build the `supabase.realtime` / `supabase.channel()` facade object.
 *
 * @param kernel - The kernel whose realtime engine to wrap.
 */
export declare function createRealtimeClient(kernel: FakebaseKernel): RealtimeClientFacade;
//# sourceMappingURL=realtime-client.d.ts.map