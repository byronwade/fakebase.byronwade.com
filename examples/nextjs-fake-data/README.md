# Example: Schema-driven fake data

A Next.js App Router blog that is **fully populated without a seed file**. The schema in
`fakebase/schema.ts` is the only input — [`@fakebase/seed`](../../docs/seeding.md) reads it
and generates realistic, foreign-key-correct rows.

```bash
pnpm install
pnpm dev      # http://localhost:3000
```

You'll see 5 generated authors and 12 generated posts — emails that look like emails,
avatars, view counts, and every post attributed to a real `users` row.

## How it works

`lib/fakebase.ts` is the whole story:

```ts
import { seedClient } from "@fakebase/seed";
import appSchema from "@/fakebase/schema";

export const supabase = createClient<Database>("local", "dev-key", { kernel });

await seedClient(supabase, appSchema, { seed: 42, tables: { users: 5, posts: 12 } });
```

- **No seed file.** Values come from the column types and names: `email` → an email,
  `first_name` → a name, `avatar_url` → an avatar, `view_count` → an integer.
- **Foreign keys are real.** Each post's `author_id` references an actual generated user.
- **Deterministic.** The fixed `seed: 42` means the same data on every reload.
- **Idempotent.** `seedClient` skips tables that already have rows.

`app/page.tsx` just reads `posts` and `users` and renders them — ordinary Server Component
queries against the `@supabase/supabase-js` call shape.

## Try it

- Change `seed: 42` to any other number → a completely different (but stable) dataset.
- Add a column to `fakebase/schema.ts` (e.g. `bio: { type: "text" }`) → it's populated
  automatically on the next reload.
- Run `pnpm fakebase seed gen --rows 20` to write the same kind of data to
  `supabase/seed.sql` for a real Supabase project.

## Next steps

See [`../nextjs-app-router-basic`](../nextjs-app-router-basic) for CRUD with Server Actions,
and [the seeding docs](../../docs/seeding.md) for overrides, the Faker provider, and the full
reference.
