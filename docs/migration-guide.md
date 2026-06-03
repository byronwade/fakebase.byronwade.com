# Migrating from Fakebase to real Supabase

Fakebase is built to be thrown away. The point of the local runtime is to get you to a working
prototype fast; the point of the export path is to make the switch to a real Supabase project
boring and low-risk. This guide walks the full handoff.

## TL;DR

```bash
fakebase migrate export --supabase   # supabase/migrations/*.sql
fakebase seed export                 # supabase/seed.sql
fakebase types gen                   # database.types.ts
fakebase verify supabase             # compatibility suite vs a local Supabase stack
```

Then swap the client import and environment variables. That's it.

## 1. Stabilize your schema

Author your schema either in the TypeScript DSL (`fakebase/schema.ts`) or as SQL migrations.
Both normalize to the same schema IR. When the shape stops changing, you're ready to export.

```bash
fakebase migrate diff      # preview the SQL diff against the current IR
fakebase migrate new add_profiles   # create a named, timestamped migration
```

## 2. Export Supabase-compatible artifacts

```bash
fakebase migrate export --supabase
```

This writes conventional Supabase files:

```
supabase/
  migrations/
    20260601120000_init.sql
    20260601130000_add_profiles.sql
  seed.sql            # via `fakebase seed export`
database.types.ts     # via `fakebase types gen`
```

The generated SQL uses standard PostgreSQL DDL (`create table if not exists`, `alter table ...
enable row level security`, policies, indexes) so it applies cleanly with the Supabase CLI or the
dashboard SQL editor.

> Review the generated SQL. Fakebase emits faithful DDL, but you own the production schema —
> confirm types, defaults, constraints, and especially **RLS policies** before applying.

## 3. Generate types

```bash
fakebase types gen
```

The generated `database.types.ts` has the same shape Supabase's generator produces — a `Database`
interface with `Tables`, `Views`, `Functions`, `Enums`, and `CompositeTypes`, plus per-table
`Row` / `Insert` / `Update` and the `Tables<>`, `TablesInsert<>`, `TablesUpdate<>` helpers. Your
app's typed queries keep working after the swap.

## 4. Verify against real Supabase

This is the **non-negotiable** step. Local RLS, auth, and SQL semantics are approximations.

```bash
# with a local Supabase stack running (supabase start)
fakebase verify supabase
```

`verify` runs the supported-scenario suite against both Fakebase and the real stack and prints a
matrix of **exact match / acceptable approximation / unsupported**. Resolve anything that doesn't
match — most commonly RLS policies and `rpc` functions that relied on JS evaluation locally.

## 5. Swap the client

The call shape is the same, so the diff is small:

```diff
- import { createClient, createMemoryKernel } from "@byronwade/fakebase";
- const kernel = createMemoryKernel<Database>({ schema });
- export const supabase = createClient<Database>("http://localhost", "local", { kernel });
+ import { createClient } from "@supabase/supabase-js";
+ export const supabase = createClient<Database>(
+   process.env.NEXT_PUBLIC_SUPABASE_URL!,
+   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
+ );
```

For Next.js SSR, switch to `@supabase/ssr` cookie helpers. Because Fakebase already used
cookie-based sessions and PKCE-shaped exchange on the server, your route handlers and Server
Components keep the same structure.

## 6. Production handoff checklist

`fakebase ai init` generates a `migration.checklist.md`, but the essentials are:

- [ ] `supabase/migrations/*.sql` applied to the real project
- [ ] `supabase/seed.sql` reviewed (don't seed production with dev data by accident)
- [ ] `database.types.ts` regenerated from the real project
- [ ] `@byronwade/*` dependencies removed from the app's runtime path
- [ ] `.fakebase/` excluded from production builds
- [ ] Auth flows tested against real Supabase Auth
- [ ] **RLS policies tested against real PostgreSQL** (not Fakebase's JS approximation)
- [ ] Storage buckets and access rules recreated
- [ ] Realtime subscriptions tested

## What will _not_ transfer automatically

- **RLS correctness.** Fakebase evaluates policies in JavaScript. Real enforcement happens in
  PostgreSQL with different planner and `SECURITY DEFINER` semantics.
- **`rpc` bodies.** Locally registered JS functions must be rewritten as SQL/PL-pgSQL functions.
- **Edge Functions.** Local handlers run as plain JS; port them to Supabase Edge Functions (Deno).
- **Signed URLs.** Local tokens are deterministic placeholders, not CDN-signed URLs.

See [security.md](security.md) for why these boundaries exist.
