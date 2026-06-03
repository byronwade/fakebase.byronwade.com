import type { EventBus, FakebaseEvent } from "@fakebase/core";
import type { BroadcastRegistry } from "./broadcast-registry.js";
import type { PresenceManager } from "./presence.js";
import type {
  BroadcastPayload,
  ChannelBinding,
  PostgresChangesFilter,
  PostgresChangesPayload,
  PresenceState,
  PresenceSyncPayload,
  RealtimeChannelStatus,
} from "./types.js";

type AnyPayload = PostgresChangesPayload | BroadcastPayload | PresenceSyncPayload;

let presenceRefCounter = 0;

function nextPresenceRef(): string {
  return `ref-${++presenceRefCounter}`;
}

export class RealtimeChannel {
  private readonly bindings: ChannelBinding[] = [];
  private readonly unsubscribers: Array<() => void> = [];
  private presenceRef: string | null = null;
  private status: RealtimeChannelStatus = "CLOSED";
  private broadcastHandler: ((payload: BroadcastPayload) => void) | null = null;

  constructor(
    private readonly name: string,
    private readonly bus: EventBus,
    private readonly presenceManager: PresenceManager,
    private readonly broadcastRegistry: BroadcastRegistry,
  ) {}

  on(
    type: "postgres_changes",
    filter: PostgresChangesFilter,
    callback: (payload: PostgresChangesPayload) => void,
  ): this;
  on(
    type: "broadcast",
    filter: { event: string },
    callback: (payload: BroadcastPayload) => void,
  ): this;
  on(
    type: "presence",
    filter: { event: string },
    callback: (payload: PresenceSyncPayload) => void,
  ): this;
  on(
    type: "postgres_changes" | "broadcast" | "presence",
    filter: PostgresChangesFilter | { event: string },
    callback: (payload: never) => void,
  ): this {
    this.bindings.push({
      type,
      filter,
      callback: callback as (payload: AnyPayload) => void,
    } as ChannelBinding);
    return this;
  }

  subscribe(callback?: (status: RealtimeChannelStatus, err?: Error) => void): this {
    this.status = "SUBSCRIBED";

    // Subscribe to EventBus for postgres_changes
    const unsubBus = this.bus.subscribe((event: FakebaseEvent) => {
      this.dispatchPostgresEvent(event);
    });
    this.unsubscribers.push(unsubBus);

    // Subscribe to BroadcastRegistry
    this.broadcastHandler = (payload: BroadcastPayload) => {
      this.dispatchBroadcast(payload);
    };
    const unsubBroadcast = this.broadcastRegistry.subscribe(
      this.name,
      this.broadcastHandler,
    );
    this.unsubscribers.push(unsubBroadcast);

    // Wire presence manager leave events for this channel
    const unsubLeave = this.presenceManager.onLeave((channel: string, ref: string) => {
      if (channel !== this.name) return;
      const leaves: Record<string, { presence_ref: string; [key: string]: unknown }[]> =
        {};
      leaves[ref] = [{ presence_ref: ref }];
      this.dispatchPresence("leave", {}, leaves);
    });
    this.unsubscribers.push(unsubLeave);

    callback?.("SUBSCRIBED");
    return this;
  }

  async unsubscribe(): Promise<"ok" | "error" | "timed out"> {
    try {
      for (const unsub of this.unsubscribers) {
        unsub();
      }
      this.unsubscribers.length = 0;

      if (this.presenceRef !== null) {
        this.presenceManager.untrack(this.name, this.presenceRef);
        this.presenceRef = null;
      }

      this.presenceManager.cleanup(this.name);
      this.status = "CLOSED";
      return "ok";
    } catch {
      return "error";
    }
  }

  async send(message: {
    type: "broadcast";
    event: string;
    payload: Record<string, unknown>;
  }): Promise<"ok" | "error"> {
    try {
      if (!this.broadcastHandler) return "error";
      const broadcastPayload: BroadcastPayload = {
        type: "broadcast",
        event: message.event,
        payload: message.payload,
      };
      this.broadcastRegistry.publish(
        this.name,
        broadcastPayload,
        this.broadcastHandler,
      );
      return "ok";
    } catch {
      return "error";
    }
  }

  async track(state: Record<string, unknown>): Promise<"ok" | "error"> {
    try {
      if (this.presenceRef === null) {
        this.presenceRef = nextPresenceRef();
      }
      const prevState = this.presenceManager.getState(this.name);
      this.presenceManager.track(this.name, this.presenceRef, state);
      const newState = this.presenceManager.getState(this.name);

      const joins: Record<string, { presence_ref: string; [key: string]: unknown }[]> =
        {};
      const ref = this.presenceRef;
      const newEntries = newState[ref];
      if (newEntries) {
        joins[ref] = newEntries;
      }
      this.dispatchPresence("join", joins, {});

      const isSync = Object.keys(prevState).length === 0;
      if (isSync) {
        this.dispatchPresence("sync", {}, {});
      }

      return "ok";
    } catch {
      return "error";
    }
  }

  async untrack(): Promise<"ok" | "error"> {
    try {
      if (this.presenceRef !== null) {
        this.presenceManager.untrack(this.name, this.presenceRef);
        this.presenceRef = null;
      }
      return "ok";
    } catch {
      return "error";
    }
  }

  presenceState(): PresenceState {
    return this.presenceManager.getState(this.name);
  }

  getStatus(): RealtimeChannelStatus {
    return this.status;
  }

  getName(): string {
    return this.name;
  }

  private dispatchPostgresEvent(event: FakebaseEvent): void {
    for (const binding of this.bindings) {
      if (binding.type !== "postgres_changes") continue;
      const filter = binding.filter as PostgresChangesFilter | undefined;
      if (!filter) continue;

      if (filter.schema && filter.schema !== event.schema) continue;
      if (filter.table && filter.table !== event.table) continue;
      if (filter.event !== "*" && filter.event !== event.type) continue;

      const payload: PostgresChangesPayload = {
        schema: event.schema,
        table: event.table,
        commit_timestamp: event.commitTimestamp,
        eventType: event.type,
        new: event.type !== "DELETE" ? event.record : {},
        old: event.oldRecord ?? (event.type === "DELETE" ? event.record : {}),
        errors: null,
      };
      binding.callback(payload);
    }
  }

  private dispatchBroadcast(payload: BroadcastPayload): void {
    for (const binding of this.bindings) {
      if (binding.type !== "broadcast") continue;
      const filter = binding.filter as { event: string } | undefined;
      if (filter && filter.event && filter.event !== payload.event) continue;
      binding.callback(payload);
    }
  }

  private dispatchPresence(
    event: "sync" | "join" | "leave",
    joins: PresenceState,
    leaves: PresenceState,
  ): void {
    for (const binding of this.bindings) {
      if (binding.type !== "presence") continue;
      const filter = binding.filter as { event: string } | undefined;
      if (filter && filter.event && filter.event !== event) continue;
      const syncPayload: PresenceSyncPayload = {
        type: "presence",
        event,
        payload: { joins, leaves },
      };
      binding.callback(syncPayload);
    }
  }
}
