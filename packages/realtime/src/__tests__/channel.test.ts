import { describe, it, expect, beforeEach } from "vitest";
import { EventBus } from "@byronwade/core";
import { BroadcastRegistry } from "../broadcast-registry.js";
import { PresenceManager } from "../presence.js";
import { RealtimeChannel } from "../channel.js";
import { RealtimeService } from "../realtime-service.js";
import type {
  PostgresChangesPayload,
  BroadcastPayload,
  PresenceSyncPayload,
} from "../types.js";

function makeChannel(name: string, bus: EventBus): RealtimeChannel {
  return new RealtimeChannel(name, bus, new PresenceManager(), new BroadcastRegistry());
}

describe("RealtimeChannel — postgres_changes", () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it("delivers INSERT event to subscribed callback", () => {
    const channel = makeChannel("test", bus);
    const received: PostgresChangesPayload[] = [];

    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, (p) =>
        received.push(p as PostgresChangesPayload),
      )
      .subscribe();

    bus.publish({
      type: "INSERT",
      schema: "public",
      table: "users",
      record: { id: "1", name: "Alice" },
      commitTimestamp: new Date().toISOString(),
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.eventType).toBe("INSERT");
    expect(received[0]?.new).toEqual({ id: "1", name: "Alice" });
    expect(received[0]?.table).toBe("users");
  });

  it("filters by event type — UPDATE only", () => {
    const channel = makeChannel("test", bus);
    const received: PostgresChangesPayload[] = [];

    channel
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users" },
        (p) => received.push(p as PostgresChangesPayload),
      )
      .subscribe();

    bus.publish({
      type: "INSERT",
      schema: "public",
      table: "users",
      record: { id: "1" },
      commitTimestamp: new Date().toISOString(),
    });

    bus.publish({
      type: "UPDATE",
      schema: "public",
      table: "users",
      record: { id: "1", name: "Bob" },
      oldRecord: { id: "1", name: "Alice" },
      commitTimestamp: new Date().toISOString(),
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.eventType).toBe("UPDATE");
    expect(received[0]?.old).toEqual({ id: "1", name: "Alice" });
  });

  it("does not deliver events for a different table", () => {
    const channel = makeChannel("test", bus);
    const received: PostgresChangesPayload[] = [];

    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (p) =>
        received.push(p as PostgresChangesPayload),
      )
      .subscribe();

    bus.publish({
      type: "INSERT",
      schema: "public",
      table: "users",
      record: { id: "1" },
      commitTimestamp: new Date().toISOString(),
    });

    expect(received).toHaveLength(0);
  });

  it("unsubscribe stops delivery", async () => {
    const channel = makeChannel("test", bus);
    const received: PostgresChangesPayload[] = [];

    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, (p) =>
        received.push(p as PostgresChangesPayload),
      )
      .subscribe();

    await channel.unsubscribe();

    bus.publish({
      type: "INSERT",
      schema: "public",
      table: "users",
      record: { id: "2" },
      commitTimestamp: new Date().toISOString(),
    });

    expect(received).toHaveLength(0);
  });
});

describe("RealtimeChannel — broadcast", () => {
  it("send() delivers to other subscribers of the same channel", async () => {
    const bus = new EventBus();
    const presenceManager = new PresenceManager();
    const broadcastRegistry = new BroadcastRegistry();

    const ch1 = new RealtimeChannel("room:1", bus, presenceManager, broadcastRegistry);
    const ch2 = new RealtimeChannel("room:1", bus, presenceManager, broadcastRegistry);
    const ch3 = new RealtimeChannel("room:2", bus, presenceManager, broadcastRegistry);

    const received1: BroadcastPayload[] = [];
    const received2: BroadcastPayload[] = [];
    const received3: BroadcastPayload[] = [];

    ch1
      .on("broadcast", { event: "msg" }, (p) => received1.push(p as BroadcastPayload))
      .subscribe();
    ch2
      .on("broadcast", { event: "msg" }, (p) => received2.push(p as BroadcastPayload))
      .subscribe();
    ch3
      .on("broadcast", { event: "msg" }, (p) => received3.push(p as BroadcastPayload))
      .subscribe();

    await ch1.send({ type: "broadcast", event: "msg", payload: { text: "hello" } });

    // ch2 (same channel name) receives; ch1 (sender) and ch3 (different name) do not
    expect(received1).toHaveLength(0);
    expect(received2).toHaveLength(1);
    expect(received2[0]?.payload).toEqual({ text: "hello" });
    expect(received3).toHaveLength(0);
  });

  it("send() returns 'error' when not subscribed", async () => {
    const bus = new EventBus();
    const ch = new RealtimeChannel(
      "room:1",
      bus,
      new PresenceManager(),
      new BroadcastRegistry(),
    );
    const result = await ch.send({ type: "broadcast", event: "msg", payload: {} });
    expect(result).toBe("error");
  });
});

describe("RealtimeChannel — presence", () => {
  it("track() adds entry to presenceState", async () => {
    const bus = new EventBus();
    const channel = makeChannel("room:chat", bus);
    channel.subscribe();

    await channel.track({ user: "Alice" });

    const state = channel.presenceState();
    const entries = Object.values(state).flat();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ user: "Alice" });
    expect(entries[0]).toHaveProperty("presence_ref");
  });

  it("untrack() removes entry from presenceState", async () => {
    const bus = new EventBus();
    const channel = makeChannel("room:chat", bus);
    channel.subscribe();

    await channel.track({ user: "Bob" });
    expect(Object.values(channel.presenceState()).flat()).toHaveLength(1);

    await channel.untrack();
    expect(Object.values(channel.presenceState()).flat()).toHaveLength(0);
  });

  it("presence join/leave events fire on track/untrack", async () => {
    const bus = new EventBus();
    const presenceManager = new PresenceManager();
    const broadcastRegistry = new BroadcastRegistry();
    const channel = new RealtimeChannel(
      "room:events",
      bus,
      presenceManager,
      broadcastRegistry,
    );

    const events: PresenceSyncPayload[] = [];
    channel
      .on("presence", { event: "join" }, (p) => events.push(p as PresenceSyncPayload))
      .subscribe();

    await channel.track({ user: "Carol" });

    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.event).toBe("join");
  });
});

describe("RealtimeService", () => {
  it("channel() returns the same instance for the same name", () => {
    const bus = new EventBus();
    const service = new RealtimeService(bus);

    const ch1 = service.channel("room:1");
    const ch2 = service.channel("room:1");
    expect(ch1).toBe(ch2);
  });

  it("getChannels() lists all channels", () => {
    const bus = new EventBus();
    const service = new RealtimeService(bus);
    service.channel("a");
    service.channel("b");
    expect(service.getChannels()).toHaveLength(2);
  });

  it("removeAllChannels() returns ok results and clears list", async () => {
    const bus = new EventBus();
    const service = new RealtimeService(bus);
    service.channel("a").subscribe();
    service.channel("b").subscribe();

    const results = await service.removeAllChannels();
    expect(results).toHaveLength(2);
    expect(results.every((r) => r === "ok")).toBe(true);
    expect(service.getChannels()).toHaveLength(0);
  });
});
