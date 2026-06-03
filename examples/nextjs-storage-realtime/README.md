# Example: Next.js Storage & Realtime

Two patterns in one app:

1. **Storage** — upload / list / delete files via Server Actions. Bytes are written to the local
   filesystem under `.fakebase/storage/`.
2. **Realtime** — Fakebase's realtime bus is in-process on the server, bridged to the browser with
   **Server-Sent Events (SSE)**.

```bash
pnpm install
pnpm dev      # http://localhost:3000  (open two tabs to see realtime fan-out)
```

## Storage

`app/page.tsx` defines Server Actions that call the storage API:

```ts
async function upload(formData: FormData) {
  "use server";
  await ensureBucket();
  const file = formData.get("file") as File;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await supabase.storage.from("uploads").upload(`${Date.now()}-${file.name}`, bytes, {
    contentType: file.type,
  });
  revalidatePath("/");
}
```

Public URLs are built with `supabase.storage.from("uploads").getPublicUrl(name)`.

## Realtime over SSE

Because the kernel is server-only, the browser can't subscribe to `supabase.channel()` directly.
Instead:

- `app/api/realtime/route.ts` holds a `postgres_changes` subscription and streams each INSERT on
  `public.events` as an SSE message.
- `app/realtime-feed.tsx` is a Client Component that reads the stream with `EventSource`.
- The `emitEvent` Server Action inserts a row, which the in-process bus delivers to the SSE
  subscription — and out to every connected tab.

```ts
// SSE bridge (server)
supabase
  .channel("events-feed")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "events" },
    (payload) => {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload.new)}\n\n`));
    },
  )
  .subscribe();
```

This mirrors how you'd consume Supabase Realtime in production — except Supabase pushes changes
over its own WebSocket instead of your SSE route. The `@fakebase/realtime` package also ships an
optional local WebSocket bridge for multi-process development.

## Differences vs real Supabase

- Signed URLs use deterministic local tokens, not CDN-signed URLs.
- Realtime here is single-process and in-memory. Presence is best-effort.
- See [`docs/compatibility-matrix.md`](../../docs/compatibility-matrix.md) for the full breakdown.
