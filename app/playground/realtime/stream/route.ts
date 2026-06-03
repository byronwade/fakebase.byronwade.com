/**
 * Server-Sent Events bridge for the playground's realtime panel. Subscribes to
 * the visitor's kernel `postgres_changes` bus and forwards every row change to
 * the browser as an SSE `change` event. Because the kernel is a module-global
 * keyed by the visitor's cookie, an insert from a Server Action on the same
 * session lands on this same kernel and streams here.
 *
 * Single-instance by nature (the in-memory kernel lives in one process); in a
 * multi-instance deployment the inserting request and this stream must share an
 * instance to see each other — consistent with the sandbox's degrade-gracefully
 * design.
 */
import { getPlaygroundClient } from "@/lib/playground/client";

export const dynamic = "force-dynamic";

type ChangePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  schema: string;
  table: string;
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
  commit_timestamp: string;
};

export async function GET(request: Request): Promise<Response> {
  const supabase = await getPlaygroundClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      send("ready", { ok: true });

      const channel = supabase
        .channel("playground-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public" },
          (payload: ChangePayload) => {
            send("change", {
              eventType: payload.eventType,
              table: payload.table,
              new: payload.new,
              old: payload.old,
              commit_timestamp: payload.commit_timestamp,
            });
          },
        )
        .subscribe();

      // Heartbeat keeps proxies from idling the connection out.
      const heartbeat = setInterval(() => send("ping", { t: Date.now() }), 25000);

      const teardown = async () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        try {
          await channel.unsubscribe();
          await supabase.removeChannel(channel);
        } catch {
          /* already gone */
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      request.signal.addEventListener("abort", teardown);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
