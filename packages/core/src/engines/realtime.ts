/**
 * Realtime engine contract + the default in-process implementation.
 *
 * The kernel emits Postgres-change events from its mutation commit pipeline;
 * the client realtime facade subscribes to those events to drive
 * `postgres_changes` channel callbacks. Broadcast and presence are layered on
 * top in the client channel (and in `@fakebase/realtime` for the richer
 * cross-process bridge).
 */

import { EventBus, type FakebaseEvent } from "../events/bus.js";

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
  payload: { joins: Record<string, unknown>; leaves: Record<string, unknown> };
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
  subscribe(
    schema: string,
    table: string,
    event: RealtimeEvent,
    callback: RealtimePostgresCallback,
  ): () => void;
  emit(change: RealtimeChange): void;
}

/**
 * Default realtime engine — wraps a {@link EventBus}. Subscribing registers a
 * filtered bus listener; emitting publishes a {@link FakebaseEvent}, so both
 * this engine's subscribers and any raw bus subscribers (e.g.
 * `@fakebase/realtime`'s `RealtimeService`) receive the change.
 */
export class InProcessRealtimeEngine implements RealtimeEngine {
  constructor(private readonly bus: EventBus) {}

  subscribe(
    schema: string,
    table: string,
    event: RealtimeEvent,
    callback: RealtimePostgresCallback,
  ): () => void {
    return this.bus.subscribe((ev: FakebaseEvent) => {
      if (ev.schema !== schema) return;
      if (table !== "*" && ev.table !== table) return;
      if (ev.type !== event) return;
      callback({
        schema: ev.schema,
        table: ev.table,
        commit_timestamp: ev.commitTimestamp,
        eventType: ev.type,
        new: ev.type !== "DELETE" ? ev.record : {},
        old: ev.oldRecord ?? (ev.type === "DELETE" ? ev.record : {}),
        errors: null,
      });
    });
  }

  emit(change: RealtimeChange): void {
    this.bus.publish({
      type: change.eventType,
      schema: change.schema,
      table: change.table,
      record: change.eventType === "DELETE" ? change.old : change.new,
      oldRecord: change.old,
      commitTimestamp: new Date().toISOString(),
    });
  }
}
