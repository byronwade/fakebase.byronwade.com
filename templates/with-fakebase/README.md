# with-fakebase

A minimal **Next.js (App Router) + Fakebase** starter. It runs a Supabase-shaped backend entirely
in-process — no Docker, no Postgres — so you can prototype immediately and export to real Supabase
later.

> **Local/dev-only.** Fakebase is not production infrastructure. See the migration guide before
> shipping.

## Getting started

```bash
# copy this folder out of the repo, then:
pnpm install        # or npm / yarn / bun
pnpm dev            # http://localhost:3000
```

## What's wired up

| File                     | Purpose                                                                      |
| ------------------------ | ---------------------------------------------------------------------------- |
| `fakebase/schema.ts`     | Canonical schema (Fakebase DSL). Source of truth for the kernel and the CLI. |
| `database.types.ts`      | Generated types (`fakebase types gen`). Same shape as Supabase's generator.  |
| `lib/fakebase.ts`        | Server-only client singleton (`createClient` + `createMemoryKernel`).        |
| `fakebase/seeds/seed.ts` | Seed script for `fakebase seed run`.                                         |
| `app/page.tsx`           | Server Component reading `notes` via `supabase.from(...).select()`.          |

## Server vs. client

The Fakebase kernel uses Node built-ins, so it must run on the server. `lib/fakebase.ts` imports
`server-only` to enforce this. Use the client from Server Components, Route Handlers, and Server
Actions; have Client Components call those Route Handlers (`app/api/*`) for mutations.

## Useful commands

```bash
pnpm fakebase types gen              # regenerate database.types.ts from schema.ts
pnpm fakebase migrate diff           # preview SQL for schema changes
pnpm fakebase migrate export --supabase   # write supabase/migrations/*.sql
pnpm fakebase seed run               # run fakebase/seeds/seed.ts
pnpm fakebase studio                 # open the dev-only admin UI
pnpm fakebase doctor                 # check setup + report unsupported APIs
```

## Switching to real Supabase

1. `pnpm fakebase migrate export --supabase`
2. `pnpm fakebase seed export`
3. `pnpm fakebase verify supabase` (against a local Supabase stack)
4. Replace `fakebase`'s `createClient` with `@supabase/supabase-js`'s `createClient` and set
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

The call shape doesn't change, so your components keep working.
