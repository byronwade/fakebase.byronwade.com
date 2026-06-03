/**
 * Realtime client facade — provides the `supabase.channel()` surface
 * on top of the kernel's minimal `RealtimeEngine` pub/sub interface.
 */

import type {
  FakebaseKernel,
  RealtimeEngine,
  RealtimeEvent,
  RealtimePostgresCallback,
  RealtimeBroadcastCallback,
  RealtimePresenceCallback,
} from "@byronwade/core";

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

type PostgresFilter = {
  event: "*" | "INSERT" | "UPDATE" | "DELETE";
  schema?: string;
  table?: string;
  filter?: string;
};

type BroadcastFilter = { event: string };
type PresenceFilter = { event: "sync" | "join" | "leave" };

type ChannelStatus = "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED";

/**
 * A realtime channel — mirrors `supabase.channel(name)`.
 */
export class Channel {
  readonly name: string;
  readonly topic: string;

  private readonly engine: RealtimeEngine;
  private readonly unsubs: Array<() => void> = [];
  private status: ChannelStatus = "CLOSED";
  private readonly broadcastListeners = new Map<
    string,
    Set<RealtimeBroadcastCallback>
  >();
  private readonly presenceListeners = new Map<string, Set<RealtimePresenceCallback>>();

  constructor(name: string, engine: RealtimeEngine) {
    this.name = name;
    this.topic = `realtime:${name}`;
    this.engine = engine;
  }

  /**
   * Subscribe to Postgres change events.
   */
  on(
    type: "postgres_changes",
    filter: PostgresFilter,
    callback: RealtimePostgresCallback,
  ): this;
  /**
   * Subscribe to broadcast events.
   */
  on(
    type: "broadcast",
    filter: BroadcastFilter,
    callback: RealtimeBroadcastCallback,
  ): this;
  /**
   * Subscribe to presence events.
   */
  on(
    type: "presence",
    filter: PresenceFilter,
    callback: RealtimePresenceCallback,
  ): this;
  on(
    type: "postgres_changes" | "broadcast" | "presence",
    filter: PostgresFilter | BroadcastFilter | PresenceFilter,
    callback:
      | RealtimePostgresCallback
      | RealtimeBroadcastCallback
      | RealtimePresenceCallback,
  ): this {
    if (type === "postgres_changes") {
      const pgFilter = filter as PostgresFilter;
      const schema = pgFilter.schema ?? "public";
      const table = pgFilter.table ?? "*";
      const events: RealtimeEvent[] =
        pgFilter.event === "*"
          ? ["INSERT", "UPDATE", "DELETE"]
          : [pgFilter.event as RealtimeEvent];

      for (const ev of events) {
        const unsub = this.engine.subscribe(
          schema,
          table,
          ev,
          callback as RealtimePostgresCallback,
        );
        this.unsubs.push(unsub);
      }
    } else if (type === "broadcast") {
      const broadcastFilter = filter as BroadcastFilter;
      const key = broadcastFilter.event;
      if (!this.broadcastListeners.has(key)) {
        this.broadcastListeners.set(key, new Set());
      }
      this.broadcastListeners.get(key)!.add(callback as RealtimeBroadcastCallback);
    } else if (type === "presence") {
      const presenceFilter = filter as PresenceFilter;
      const key = presenceFilter.event;
      if (!this.presenceListeners.has(key)) {
        this.presenceListeners.set(key, new Set());
      }
      this.presenceListeners.get(key)!.add(callback as RealtimePresenceCallback);
    }

    return this;
  }

  /**
   * Activate the channel subscriptions.
   *
   * @param callback - Optional status callback invoked when subscription state changes.
   */
  subscribe(callback?: (status: ChannelStatus, err?: Error) => void): this {
    this.status = "SUBSCRIBED";
    queueMicrotask(() => callback?.("SUBSCRIBED"));
    return this;
  }

  /** Deactivate the channel, removing all kernel subscriptions. */
  async unsubscribe(): Promise<"ok" | "timed out" | "error"> {
    for (const unsub of this.unsubs) unsub();
    this.unsubs.length = 0;
    this.status = "CLOSED";
    return "ok";
  }

  /**
   * Broadcast a message on this channel.
   *
   * In the memory kernel, broadcast listeners registered on the same channel
   * object are called synchronously. Remote broadcast (across processes) is
   * not supported by the in-memory adapter.
   */
  async send(payload: {
    type: string;
    event: string;
    payload?: Record<string, unknown>;
  }): Promise<"ok" | "error" | "rate limited"> {
    if (payload.type === "broadcast") {
      const cbs = this.broadcastListeners.get(payload.event);
      if (cbs) {
        for (const cb of cbs) {
          cb({
            type: payload.type,
            event: payload.event,
            payload: payload.payload ?? {},
          });
        }
      }
    }
    return "ok";
  }

  /** Current subscription status. */
  getStatus(): ChannelStatus {
    return this.status;
  }
}

// ---------------------------------------------------------------------------
// RealtimeClientFacade
// ---------------------------------------------------------------------------

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
export function createRealtimeClient(kernel: FakebaseKernel): RealtimeClientFacade {
  const engine = kernel.realtime;
  const channels = new Map<string, Channel>();

  return {
    channel(name: string, _options?: Record<string, unknown>): Channel {
      if (!channels.has(name)) {
        channels.set(name, new Channel(name, engine));
      }
      return channels.get(name)!;
    },

    getChannels(): Channel[] {
      return [...channels.values()];
    },

    async removeChannel(channel: Channel): Promise<"error" | "timed out" | "ok"> {
      const result = await channel.unsubscribe();
      channels.delete(channel.name);
      return result;
    },

    async removeAllChannels(): Promise<("error" | "timed out" | "ok")[]> {
      const results: ("error" | "timed out" | "ok")[] = [];
      for (const ch of channels.values()) {
        results.push(await ch.unsubscribe());
      }
      channels.clear();
      return results;
    },
  };
}
