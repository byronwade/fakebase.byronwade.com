# Fakebase

[![CI](https://github.com/byronwade/fakebase/actions/workflows/ci.yml/badge.svg)](https://github.com/byronwade/fakebase/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/fakebase.svg)](https://www.npmjs.com/package/fakebase)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with Claude Code](https://img.shields.io/badge/built%20with-Claude%20Code-d97757.svg)](https://claude.com/claude-code)

**An open-source, Supabase-shaped, local/dev-only development platform — anywhere `@supabase/supabase-js` runs.**

Fakebase mimics the _developer-facing shape_ of Supabase — `createClient`, `from().select()`,
`auth`, `storage`, `realtime`, `rpc` — backed by an in-process kernel with memory, JSON, and
SQLite adapters. Build prototypes at zero-setup speed, then export real Supabase SQL migrations
and `database.types.ts` when you're ready to move to production. It works in any framework that
speaks the Supabase client contract — Next.js, SvelteKit, Astro, Remix, plain Node, and more.

> [!WARNING]
> **Fakebase is for local development and prototyping only.** It is **not** production
> infrastructure, **not** production authentication, and **not** a security boundary. Its
> Row Level Security is a JavaScript approximation of PostgreSQL RLS. Always export to real
> Supabase and run `fakebase verify supabase` before shipping. See [docs/security.md](docs/security.md).

---

## Why Fakebase?

I built Fakebase because I kept hitting the same wall while prototyping — especially with AI in
the loop. I wanted to move fast on a design and have the schema and migrations come along for the
ride, instead of stopping to re-provision a database and hand-sync migrations every time the shape
of an idea changed. Fakebase is the tool I wanted: a Supabase-shaped backend that runs in-process,
so you can iterate on a near-launch-ready prototype as fast as you (or your AI) can change your
mind — then export real migrations and types when it settles, instead of rewriting them. Quick and
easy for prototyping, honest about the path to production.

Concretely, it removes the up-front setup tax — Docker, a local Postgres stack, migrations, and
seed data before a single screen exists — while keeping you on the **exact API surface** you'll
ship against:

- **Supabase-compatible client** — the call shape matches `@supabase/supabase-js`, so your app
  code barely changes when you switch.
- **Zero setup** — `createMemoryKernel()` or a `.fakebase/` JSON folder; no Docker, no Postgres.
- **First-class export path** — generate `supabase/migrations/*.sql`, `supabase/seed.sql`, and
  `database.types.ts` that drop straight into a real Supabase project.
- **Honest capability labels** — unsupported features throw a structured `CapabilityError`
  instead of silently faking behavior.
- **Realistic fake data, free** — `@fakebase/seed` fills every table straight from your
  schema (FK-correct, deterministic), so you never hand-write seed files. Swap in
  `@faker-js/faker` for richer data. See [docs/seeding.md](docs/seeding.md).
- **AI-first** — generate rules, schema summaries, and agent prompts (`fakebase ai init`).

## Quick start

```bash
pnpm add fakebase
```

```ts
// lib/fakebase.ts  (server-only — the kernel uses Node fs/path/crypto)
import "server-only";
import { createClient, createMemoryKernel } from "fakebase";
import type { Database } from "@/database.types";

const kernel = createMemoryKernel<Database>({
  schema: {
    version: 1,
    tables: [
      {
        name: "posts",
        schema: "public",
        primaryKey: "id",
        columns: [
          { name: "id", type: "uuid", nullable: false, primaryKey: true },
          { name: "title", type: "text", nullable: false },
          { name: "published", type: "bool", nullable: false, defaultSql: "false" },
          { name: "created_at", type: "timestamptz", nullable: false },
        ],
        indexes: [],
        policies: [],
        rlsEnabled: false,
      },
    ],
    enums: [],
    functions: [],
    views: [],
  },
});

export const supabase = createClient<Database>("http://localhost", "local-anon-key", {
  kernel,
});
```

```tsx
// app/posts/page.tsx  (Server Component)
import { supabase } from "@/lib/fakebase";

export default async function PostsPage() {
  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });

  return (
    <ul>
      {posts?.map((p) => (
        <li key={p.id}>{p.title}</li>
      ))}
    </ul>
  );
}
```

> **Server-only note:** The Fakebase kernel is backed by Node built-ins, so it must run on the
> server — read on the server and route client writes through your framework's API layer (Next.js
> Server Components / Route Handlers, SvelteKit load + form actions, Astro endpoints, etc.). The
> live playground in [`apps/web`](apps/web) (route `/playground`) and the focused
> [`examples/`](examples) apps show the full pattern (server reads + server-side mutations for
> client writes).

## CLI

```bash
npx fakebase init                 # scaffold config, schema, seeds, Next.js helpers
npx fakebase dev                  # start the local runtime
npx fakebase studio               # open the dev-only admin UI
npx fakebase migrate new <name>   # create a timestamped SQL migration
npx fakebase migrate diff         # diff schema IR and write a migration
npx fakebase migrate export       # write Supabase-friendly migration files
npx fakebase seed export          # generate supabase/seed.sql from current data
npx fakebase seed gen             # generate fake data from your schema -> seed.sql
npx fakebase types gen            # generate database.types.ts
npx fakebase verify supabase      # run the compatibility suite vs real Supabase
npx fakebase ai init              # scaffold AI rules + schema summaries
npx fakebase doctor               # report unsupported APIs + adapter limits
```

Full reference: [docs/cli.md](docs/cli.md).

## Migration to real Supabase

Fakebase is designed to be thrown away. The path to production is intentionally short:

1. `fakebase migrate export --supabase` → `supabase/migrations/*.sql`
2. `fakebase seed export` → `supabase/seed.sql`
3. `fakebase types gen` → `database.types.ts` (identical shape to Supabase's generator)
4. `fakebase verify supabase` against a local Supabase stack
5. Swap `fakebase`'s `createClient` for `@supabase/supabase-js`'s `createClient`

See [docs/migration-guide.md](docs/migration-guide.md).

## Feature matrix (high level)

| Area                                               | Status                         | Notes                                                                       |
| -------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------- |
| Database CRUD + filters + `rpc`                    | Supported                      | PostgREST-style chaining, `single`/`maybeSingle`, 0-based inclusive `range` |
| Auth (password, OTP, session, admin basics)        | Supported                      | Cookie + memory + localStorage session adapters; local OTP inbox            |
| Storage (buckets, upload/list/remove, signed URLs) | Supported                      | Local filesystem under `.fakebase/storage/`                                 |
| Realtime (broadcast, Postgres changes, presence)   | Supported / Partial            | In-process pub/sub; presence is best-effort                                 |
| Migrations + SQL export + type generation          | Supported                      | Supabase-compatible artifacts                                               |
| Schema-driven fake data (`@fakebase/seed`)          | Supported                      | FK-correct + deterministic; built-in or Faker provider                      |
| RLS (grants, USING/WITH CHECK, roles)              | Partial                        | JavaScript approximation — **not** production RLS                           |
| Functions / `functions.invoke`                     | Partial                        | Local JS registry; not a Deno edge runtime                                  |
| OAuth / SSO / MFA / passkeys / PITR / vector       | Unsupported (capability-gated) | Returns `CapabilityError`; documented in the matrix                         |

Full method-by-method matrix: [docs/compatibility-matrix.md](docs/compatibility-matrix.md).

## Monorepo layout

```
apps/
  web/                  # marketing + docs site + live /playground (Next.js, byronwade/ui)
  admin/                # dev-only admin UI (Next.js)
packages/
  fakebase              # main entry point: createClient + kernel factories
  client                # Supabase-shaped client facades
  core                  # kernel, schema IR, policy engine, query compiler, errors
  adapter-memory        # zero-setup Map store
  adapter-json          # file-backed snapshots under .fakebase/
  adapter-sqlite        # durable single-file DB (WAL)
  adapter-pglite        # real Postgres-in-WASM, highest fidelity, no native build
  auth | storage | realtime | functions
  migrations            # diff, SQL export, snapshot/restore
  seed                  # schema-driven fake data engine (built-in provider)
  seed-faker            # optional @faker-js/faker provider for @fakebase/seed
  types                 # database.types.ts generator
  cli                   # init/dev/studio/migrate/types/seed/verify/doctor/ai
  ai                    # rules + summaries + agent prompt generation
  test-utils            # contract suite + compatibility harness
examples/               # focused Next.js usage references
templates/with-fakebase # copy-pasteable starter
docs/                   # architecture, compatibility, migration, security, cli, admin, ai
```

## Development

Requires Node `>=20` and `pnpm@10`.

```bash
pnpm install      # install the workspace
pnpm build        # turbo build all packages + apps
pnpm test         # run all unit/integration tests (Vitest)
pnpm test:e2e     # admin UI smoke tests (Playwright)
pnpm typecheck    # tsc across the workspace
pnpm lint         # ESLint
pnpm format       # Prettier
```

Releases use [Changesets](https://github.com/changesets/changesets): run `pnpm changeset`,
then merge to `main` where the release workflow publishes the public `@fakebase/*` packages.

## License

[MIT](LICENSE) © Byron Wade.

---

Fakebase is open source and was built end-to-end with [Claude Code](https://claude.com/claude-code).
Issues and pull requests are welcome.
