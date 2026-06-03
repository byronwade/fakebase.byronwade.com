import { supabase } from "@/lib/fakebase";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events bridge for Fakebase realtime.
 *
 * Fakebase's realtime bus is in-process on the server. This route holds a
 * `postgres_changes` subscription and forwards each INSERT on `public.events`
 * to the browser as an SSE message. A Server Action that inserts into `events`
 * (see `app/page.tsx`) shares the same kernel singleton, so the change reaches
 * this subscription and is streamed to every connected client.
 */
export async function GET() {
  const encoder = new TextEncoder();
  let channel: ReturnType<typeof supabase.channel> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));
      channel = supabase
        .channel("events-feed")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "events" },
          (payload) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(payload.new)}\n\n`),
            );
          },
        )
        .subscribe();
    },
    async cancel() {
      await channel?.unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
