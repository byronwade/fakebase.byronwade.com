# Getting Started

This walkthrough takes you from an empty project to a working, data-backed app — with **zero
backend setup** — and then shows the short path to a real Supabase project. It works in any
framework that speaks the Supabase client contract (Next.js, SvelteKit, Astro, Remix, plain
Node, and more); the examples below use Next.js for concreteness. Every step uses the exact
`@supabase/supabase-js` call shape, so nothing you learn here is throwaway.

> [!NOTE]
> Fakebase is **local/dev-only**. It is not production auth, authorization, or infrastructure.
> The goal is to get you to a working prototype fast, then out of the way.

## 1. Install

```bash
pnpm add @byronwade/fakebase
```

You need Node `>=20`. No Docker, no local Postgres, no migrations to run first.

## 2. Define your schema and client

The kernel is backed by Node built-ins (`fs`, `crypto`), so it runs **only on the server**.
Create a single server-only module that owns the schema and exports a client.

```ts
// lib/fakebase.ts  (server-only)
import "server-only";
import { createClient, createMemoryKernel } from "@byronwade/fakebase";
import type { ProjectSchemaIR } from "@byronwade/fakebase";
import type { Database } from "@/database.types";

const schema: ProjectSchemaIR = {
  version: 1,
  enums: [],
  functions: [],
  tables: [
    {
      schema: "public",
      name: "posts",
      primaryKey: "id",
      rlsEnabled: false,
      policies: [],
      indexes: [],
      columns: [
        {
          name: "id",
          type: "uuid",
          nullable: false,
          primaryKey: true,
          defaultSql: "gen_random_uuid()",
        },
        { name: "title", type: "text", nullable: false },
        { name: "published", type: "bool", nullable: false, defaultSql: "false" },
        {
          name: "created_at",
          type: "timestamptz",
          nullable: false,
          defaultSql: "now()",
        },
      ],
    },
  ],
};

const kernel = createMemoryKernel<Database>(schema);

export const supabase = createClient<Database>("local", "dev-key", { kernel });
```

`createMemoryKernel` is synchronous — there is no async bootstrap — so you can construct it in
module scope and import `supabase` anywhere on the server.

> Want durability instead of an in-memory store? Swap `createMemoryKernel` for
> `createJsonKernel` (writes to `.fakebase/`) or `createSqliteKernel`. The app code does not
> change. See [Architecture](architecture).

### Optional: fill it with fake data

An empty database is no fun to build against. `@byronwade/seed` generates realistic,
referentially-correct rows straight from your schema — emails look like emails, foreign
keys point at real parent rows, enums stay valid:

```ts
import { seedClient } from "@byronwade/seed";

// Idempotent — skips tables that already have rows.
await seedClient(supabase, schema, { rowsPerTable: 20 });
```

When you ship, `fakebase seed gen` writes the same data to `supabase/seed.sql`. Full guide:
**[Fake Data Generation](seeding)**.

## 3. Read in a Server Component

Reads happen on the server during render — no API round-trip, no client JavaScript.

```tsx
// app/posts/page.tsx
import { supabase } from "@/lib/fakebase";

export default async function PostsPage() {
  const { data: posts, error } = await supabase
    .from("posts")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error) return <p>Failed to load: {error.message}</p>;

  return (
    <ul>
      {posts?.map((p) => (
        <li key={p.id}>{p.title}</li>
      ))}
    </ul>
  );
}
```

## 4. Write with a Server Action

Because the kernel is server-only, client writes go through a Server Action (or a Route
Handler). The call shape is identical to Supabase.

```tsx
// app/posts/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/fakebase";

export async function createPost(formData: FormData) {
  const { data, error } = await supabase
    .from("posts")
    .insert({ title: String(formData.get("title")), published: true })
    .select();

  revalidatePath("/posts");
  return { data, error: error?.message ?? null };
}
```

Wire it to a `<form action={createPost}>` in a Client Component. That's the whole
read-on-server, write-through-an-action pattern.

> Try all of this live, with no install, in the [Playground](/playground) — every action
> there shows the real `{ data, error }` it returns.

## 5. Add auth

Auth uses local, GoTrue-shaped flows. Same surface as Supabase:

```ts
await supabase.auth.signUp({ email, password });
await supabase.auth.signInWithPassword({ email, password });
const { data } = await supabase.auth.getUser();
await supabase.auth.signOut();
```

Unsupported flows (OAuth, SSO, MFA, passkeys) return a structured `CapabilityError` instead of
silently doing nothing — so you always know what is and isn't real. See the
[Compatibility Matrix](compatibility-matrix).

## 6. Ship: export to real Supabase

Fakebase is designed to be thrown away. When you're ready:

```bash
fakebase migrate export --supabase   # supabase/migrations/*.sql from your schema IR
fakebase seed export                 # supabase/seed.sql from your local data
fakebase types gen                   # database.types.ts (identical shape to Supabase's)
fakebase verify supabase             # run the compatibility suite vs a real Supabase stack
```

Then swap the import — `fakebase`'s `createClient` for `@supabase/supabase-js`'s `createClient` —
and your app code stays the same. Full details in the [Migration Guide](migration-guide).

## Where to go next

- [How it works](/how-it-works) — the kernel, adapters, and an anatomy-of-a-query walkthrough.
- [Playground](/playground) — run real queries against a live in-memory kernel.
- [Architecture](architecture) — the design and the three layers of fidelity.
- [Security](security) — the boundaries of the RLS/auth approximations (read before you ship).
