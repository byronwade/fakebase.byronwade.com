# Example: Next.js App Router — Basic CRUD

The smallest useful Fakebase app: a notes list with create / toggle / delete, built with
**Server Components + Server Actions**. There are no API routes and no client-side JavaScript —
every read and mutation calls the Fakebase client on the server.

```bash
pnpm install
pnpm dev      # http://localhost:3000
```

## How it works

- `lib/fakebase.ts` builds a server-only in-memory kernel from `fakebase/schema.ts` and exports a
  `supabase` client (same shape as `@supabase/supabase-js`).
- `app/page.tsx` is a Server Component. It reads notes with
  `supabase.from("notes").select("*").order(...)`.
- Mutations are **Server Actions** (`"use server"`) that call `insert` / `update` / `delete` and
  then `revalidatePath("/")`.

```ts
async function addNote(formData: FormData) {
  "use server";
  await supabase.from("notes").insert({ title: String(formData.get("title")) });
  revalidatePath("/");
}
```

## Why server-side?

The Fakebase kernel uses Node built-ins, so it runs on the server only (`lib/fakebase.ts` imports
`server-only`). Server Actions are the cleanest way to mutate from a form without writing a
client component or an API route.

## Next steps

- `pnpm fakebase types gen` to regenerate `database.types.ts` after editing the schema.
- `pnpm fakebase migrate export --supabase` to produce real Supabase SQL.
- See [`../../templates/with-fakebase`](../../templates/with-fakebase) for a starter you can copy,
  and [`../nextjs-ssr-auth`](../nextjs-ssr-auth) / [`../nextjs-storage-realtime`](../nextjs-storage-realtime)
  for auth and storage/realtime patterns.
