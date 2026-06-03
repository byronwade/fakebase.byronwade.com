/**
 * Realtime over websockets, speaking the Phoenix channels protocol that
 * `@supabase/realtime-js` (inside supabase-js) expects, bridged to the kernel's
 * in-process realtime engine.
 *
 * The Phoenix JS serializer encodes each message as a JSON array:
 *   [join_ref, ref, topic, event, payload]
 */
import type { FakebaseKernel, RealtimeEvent } from "@byronwade/core";

/** Minimal structural type for a ws socket (the `ws` package's WebSocket). */
export interface WsLike {
  send(data: string): void;
  on(event: "message", cb: (data: unknown) => void): void;
  on(event: "close", cb: () => void): void;
}

type PhoenixMessage = [string | null, string | null, string, string, Record<string, unknown>];

const EVENTS: RealtimeEvent[] = ["INSERT", "UPDATE", "DELETE"];

/** Attach the Phoenix protocol to one connection. */
export function handleRealtimeConnection(socket: WsLike, kernel: FakebaseKernel): void {
  const unsubscribers: Array<() => void> = [];
  let bindingId = 0;

  const sendReply = (
    joinRef: string | null,
    ref: string | null,
    topic: string,
    response: Record<string, unknown>,
    status = "ok",
  ) => {
    const msg: PhoenixMessage = [joinRef, ref, topic, "phx_reply", { status, response }];
    socket.send(JSON.stringify(msg));
  };

  socket.on("message", (raw: unknown) => {
    let msg: PhoenixMessage;
    try {
      msg = JSON.parse(String(raw)) as PhoenixMessage;
    } catch {
      return;
    }
    const [joinRef, ref, topic, event, payload] = msg;

    // Heartbeat keep-alive.
    if (topic === "phoenix" && event === "heartbeat") {
      sendReply(joinRef, ref, topic, {});
      return;
    }

    // Channel join: subscribe to the requested postgres_changes and ack with ids.
    if (event === "phx_join") {
      const config = (payload?.config as Record<string, unknown>) ?? {};
      const requested = (config.postgres_changes as Array<Record<string, unknown>>) ?? [];
      const acked: Array<Record<string, unknown>> = [];

      for (const change of requested) {
        const id = ++bindingId;
        const schema = String(change.schema ?? "public");
        const table = String(change.table ?? "*");
        const evt = String(change.event ?? "*");
        const events = evt === "*" ? EVENTS : [evt as RealtimeEvent];

        for (const e of events) {
          const unsub = kernel.realtime.subscribe(schema, table, e, (chg) => {
            const message: PhoenixMessage = [
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
            ];
            socket.send(JSON.stringify(message));
          });
          unsubscribers.push(unsub);
        }
        acked.push({ id, event: evt, schema, table, ...(change.filter ? { filter: change.filter } : {}) });
      }

      sendReply(joinRef, ref, topic, { postgres_changes: acked });
      return;
    }

    // Broadcast: echo to this socket (in-process; cross-client is Phase 3+).
    if (event === "broadcast") {
      sendReply(joinRef, ref, topic, {});
      const message: PhoenixMessage = [null, null, topic, "broadcast", payload];
      socket.send(JSON.stringify(message));
      return;
    }

    if (event === "phx_leave") {
      sendReply(joinRef, ref, topic, {});
    }
  });

  socket.on("close", () => {
    for (const unsub of unsubscribers) unsub();
  });
}
