/**
 * Realtime over websockets, speaking the Phoenix channels protocol that
 * `@supabase/realtime-js` expects, bridged to the kernel's realtime engine.
 *
 * The Phoenix JS serializer encodes each message as a JSON array:
 *   [join_ref, ref, topic, event, payload]
 *
 * A per-server {@link RealtimeHub} tracks every connected socket by topic so
 * `broadcast` reaches *other* clients (cross-client), not just the sender.
 */
import type { FakebaseKernel, RealtimeEvent } from "@byronwade/core";

export interface WsLike {
  send(data: string): void;
  on(event: "message", cb: (data: unknown) => void): void;
  on(event: "close", cb: () => void): void;
}

type PhoenixMessage = [string | null, string | null, string, string, Record<string, unknown>];

const EVENTS: RealtimeEvent[] = ["INSERT", "UPDATE", "DELETE"];

/** Tracks live sockets per topic for cross-client broadcast. */
export class RealtimeHub {
  private readonly topics = new Map<string, Set<WsLike>>();

  join(topic: string, socket: WsLike): void {
    let set = this.topics.get(topic);
    if (!set) this.topics.set(topic, (set = new Set()));
    set.add(socket);
  }

  /** Relay a message to all sockets on `topic`, optionally including the sender. */
  broadcast(topic: string, message: PhoenixMessage, sender: WsLike, self: boolean): void {
    const json = JSON.stringify(message);
    for (const socket of this.topics.get(topic) ?? []) {
      if (socket === sender && !self) continue;
      socket.send(json);
    }
  }

  /** Relay a message to every socket on `topic` (used by the HTTP broadcast API). */
  relay(topic: string, message: PhoenixMessage): void {
    const json = JSON.stringify(message);
    for (const socket of this.topics.get(topic) ?? []) socket.send(json);
  }

  remove(socket: WsLike): void {
    for (const set of this.topics.values()) set.delete(socket);
  }
}

/**
 * Handle `POST /realtime/v1/api/broadcast` — how supabase-js sends broadcasts.
 * Body: `{ messages: [{ topic, event, payload }] }` where `topic` is the bare
 * channel name; ws subscribers live under `realtime:<topic>`.
 */
export function handleBroadcastHttp(body: unknown, hub: RealtimeHub): Response {
  const messages = ((body as { messages?: unknown[] })?.messages ?? []) as Array<{
    topic?: string;
    event?: string;
    payload?: unknown;
  }>;
  for (const m of messages) {
    const topic = `realtime:${m.topic ?? ""}`;
    hub.relay(topic, [
      null,
      null,
      topic,
      "broadcast",
      { type: "broadcast", event: m.event, payload: m.payload },
    ]);
  }
  return new Response(JSON.stringify({ message: "ok" }), {
    status: 202,
    headers: { "content-type": "application/json" },
  });
}

/** Attach the Phoenix protocol to one connection. */
export function handleRealtimeConnection(
  socket: WsLike,
  kernel: FakebaseKernel,
  hub: RealtimeHub,
): void {
  const unsubscribers: Array<() => void> = [];
  const broadcastSelf = new Map<string, boolean>();
  let bindingId = 0;

  const reply = (
    joinRef: string | null,
    ref: string | null,
    topic: string,
    response: Record<string, unknown>,
    status = "ok",
  ) => socket.send(JSON.stringify([joinRef, ref, topic, "phx_reply", { status, response }]));

  socket.on("message", (raw: unknown) => {
    let msg: PhoenixMessage;
    try {
      msg = JSON.parse(String(raw)) as PhoenixMessage;
    } catch {
      return;
    }
    const [joinRef, ref, topic, event, payload] = msg;

    if (topic === "phoenix" && event === "heartbeat") {
      reply(joinRef, ref, topic, {});
      return;
    }

    if (event === "phx_join") {
      hub.join(topic, socket);
      const config = (payload?.config as Record<string, unknown>) ?? {};
      broadcastSelf.set(topic, Boolean((config.broadcast as { self?: boolean })?.self));

      const requested = (config.postgres_changes as Array<Record<string, unknown>>) ?? [];
      const acked: Array<Record<string, unknown>> = [];
      for (const change of requested) {
        const id = ++bindingId;
        const schema = String(change.schema ?? "public");
        const table = String(change.table ?? "*");
        const evt = String(change.event ?? "*");
        for (const e of evt === "*" ? EVENTS : [evt as RealtimeEvent]) {
          unsubscribers.push(
            kernel.realtime.subscribe(schema, table, e, (chg) => {
              socket.send(
                JSON.stringify([
                  null,
                  null,
                  topic,
                  "postgres_changes",
                  {
                    ids: [id],
                    data: {
                      schema: chg.schema,
                      table: chg.table,
                      commit_timestamp: chg.commit_timestamp,
                      type: chg.eventType,
                      errors: null,
                      columns: [],
                      record: chg.eventType !== "DELETE" ? chg.new : {},
                      old_record: chg.old ?? {},
                    },
                  },
                ]),
              );
            }),
          );
        }
        acked.push({
          id,
          event: evt,
          schema,
          table,
          ...(change.filter ? { filter: change.filter } : {}),
        });
      }
      reply(joinRef, ref, topic, { postgres_changes: acked });
      return;
    }

    // Cross-client broadcast: relay to every other socket on the topic.
    if (event === "broadcast") {
      if (ref) reply(joinRef, ref, topic, {}); // ack when a ref is present
      hub.broadcast(
        topic,
        [null, null, topic, "broadcast", payload],
        socket,
        broadcastSelf.get(topic) ?? false,
      );
      return;
    }

    if (event === "phx_leave") {
      hub.remove(socket);
      reply(joinRef, ref, topic, {});
    }
  });

  socket.on("close", () => {
    hub.remove(socket);
    for (const unsub of unsubscribers) unsub();
  });
}
