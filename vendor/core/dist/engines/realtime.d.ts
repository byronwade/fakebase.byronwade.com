/**
 * Realtime engine contract + the default in-process implementation.
 *
 * The kernel emits Postgres-change events from its mutation commit pipeline;
 * the client realtime facade subscribes to those events to drive
 * `postgres_changes` channel callbacks. Broadcast and presence are layered on
 * top in the client channel (and in `@fakebase/realtime` for the richer
 * cross-process bridge).
 */
import { EventBus } from "../events/bus.js";
/** A row-change event type. */
export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE";
/** The payload delivered to a `postgres_changes` subscriber. */
export interface RealtimePayload {
    schema: string;
    table: string;
    commit_timestamp: string;
    eventType: RealtimeEvent;
    new: Record<string, unknown>;
    old: Record<string, unknown>;
    errors: string[] | null;
}
export type RealtimePostgresCallback = (payload: RealtimePayload) => void;
export type RealtimeBroadcastCallback = (payload: {
    type: string;
    event: string;
    payload: Record<string, unknown>;
}) => void;
export type RealtimePresenceCallback = (payload: {
    type: "presence";
    event: "sync" | "join" | "leave";
    payload: {
        joins: Record<string, unknown>;
        leaves: Record<string, unknown>;
    };
}) => void;
/** A change emitted into the realtime engine by the kernel. */
export interface RealtimeChange {
    schema: string;
    table: string;
    eventType: RealtimeEvent;
    new: Record<string, unknown>;
    old: Record<string, unknown>;
}
/**
 * The minimal realtime pub/sub the client channel builds on.
 * `subscribe` returns an unsubscribe function.
 */
export interface RealtimeEngine {
    subscribe(schema: string, table: string, event: RealtimeEvent, callback: RealtimePostgresCallback): () => void;
    emit(change: RealtimeChange): void;
}
/**
 * Default realtime engine — wraps a {@link EventBus}. Subscribing registers a
 * filtered bus listener; emitting publishes a {@link FakebaseEvent}, so both
 * this engine's subscribers and any raw bus subscribers (e.g.
 * `@fakebase/realtime`'s `RealtimeService`) receive the change.
 */
export declare class InProcessRealtimeEngine implements RealtimeEngine {
    private readonly bus;
    constructor(bus: EventBus);
    subscribe(schema: string, table: string, event: RealtimeEvent, callback: RealtimePostgresCallback): () => void;
    emit(change: RealtimeChange): void;
}
//# sourceMappingURL=realtime.d.ts.map