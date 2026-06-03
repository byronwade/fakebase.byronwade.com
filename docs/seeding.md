# Fake Data Generation

Fakebase generates **realistic, referentially-correct fake data straight from your
schema** — no hand-written seed files. Define your tables, and every column is filled
with sensible values: emails look like emails, foreign keys point at real parent rows,
enums only ever hold declared values.

It is the same idea as the storage adapters — **pick your fidelity**. The built-in
generator ships zero-dependency and is good enough for most prototyping; install the
optional Faker provider when you want richer data and locales.

> [!NOTE]
> Two entry points, one engine: call it **at runtime** to auto-fill your dev database, or
> from the **CLI** to write a deterministic `supabase/seed.sql` you commit and ship.

## Before you start

You need three things. If all three are true, everything below "just works":

1. **A schema.** Either a `ProjectSchemaIR` object you pass to the kernel (runtime), or — for
   the CLI — a `fakebase/schema.ts` or SQL migrations under `fakebase/migrations` or
   `supabase/migrations`. No schema → nothing to generate.
2. **Server-side execution.** The kernel uses Node built-ins (`fs`, `crypto`), so seeding
   runs **only on the server** — never in a browser/client component. Node `>=20`.
3. **The package installed:** `pnpm add @byronwade/seed` (the CLI bundles it already).

That's it. RLS will **not** block seeding — the kernel runs as `service_role` by default, so
inserts bypass row-level security. (See [Troubleshooting](#troubleshooting) if you changed
the role yourself.)

## Two ways to use it

| You want…                                              | Use                          |
| ------------------------------------------------------ | ---------------------------- |
| A populated database the moment your prototype boots   | `seedClient()` at runtime    |
| A reviewable, committable `supabase/seed.sql`          | `fakebase seed gen` (CLI)    |
| Full realism / locales                                 | the `@byronwade/seed-faker` provider |

Everything that makes the data *correct* — primary-key uniqueness, foreign-key integrity,
enum validity, `unique`/`nullable` handling, deterministic output — lives in the engine.
A data **provider** only supplies the leaf values, which is why Faker drops in without
changing any of that behavior.

## Quick start — runtime (instant dev data)

```bash
pnpm add @byronwade/fakebase @byronwade/seed
```

```ts
// lib/fakebase.ts  — SERVER-ONLY. Do not import this from a client component.
import "server-only";
import { createClient, createMemoryKernel } from "@byronwade/fakebase";
import type { ProjectSchemaIR } from "@byronwade/fakebase";
import { seedClient } from "@byronwade/seed";

// 1. Your schema (the SAME object goes to the kernel AND to seedClient).
const schema: ProjectSchemaIR = {
  version: 1,
  enums: [],
  functions: [],
  tables: [
    {
      schema: "public",
      name: "users",
      primaryKey: "id",
      rlsEnabled: false,
      policies: [],
      indexes: [],
      columns: [
        { name: "id", type: "uuid", nullable: false, primaryKey: true },
        { name: "email", type: "text", nullable: false, unique: true },
        { name: "first_name", type: "text", nullable: false },
      ],
    },
  ],
};

// 2. Build the kernel and client (the url/key are ignored — API parity only).
const kernel = createMemoryKernel(schema);
export const supabase = createClient("local", "dev-key", { kernel });

// 3. Fill every table. `await` at module scope is fine in a server module.
//    Idempotent: tables that already have rows are skipped, so this is safe to
//    run on every boot.
await seedClient(supabase, schema, { rowsPerTable: 20 });
```

That's the whole setup. Anywhere on the server you can now `import { supabase }` and query
real, populated data.

> [!IMPORTANT]
> Pass `seedClient` the **same `schema`** you gave the kernel. It uses it to know the tables,
> their columns, and the foreign-key order. A mismatched schema will try to insert into tables
> the kernel doesn't have.

### Verify it worked

```ts
const { data, error } = await supabase.from("users").select("*");
console.log(error ?? `${data?.length} users seeded`); // -> "20 users seeded"
```

`seedClient` also returns a summary:

```ts
const result = await seedClient(supabase, schema, { rowsPerTable: 20 });
// result.inserted -> { users: 20 }
// result.skipped  -> []   (tables that already had rows)
```

Pass `force: true` to insert even into non-empty tables.

## Quick start — CLI (deterministic, exportable)

```bash
fakebase seed gen --rows 20
```

This writes `supabase/seed.sql` — referentially-correct `INSERT` statements that load
straight into a real Supabase/Postgres database.

**What counts as a schema for the CLI** (checked in this order):

1. A TypeScript schema at `fakebase/schema.ts` (or your configured `schemaPath`).
2. SQL migrations under `fakebase/migrations/` or `supabase/migrations/`.

If neither exists you'll get `No tables found in your schema.` — create one (e.g.
`fakebase init`) first.

| Flag                    | Purpose                                                        |
| ----------------------- | ------------------------------------------------------------- |
| `--rows <n>`            | Rows per table (default 10, or your config value).            |
| `--table <name:count>`  | Per-table override. Repeatable: `--table posts:100 --table comments:300`. |
| `--seed <n>`            | RNG seed for deterministic output (default 0).                |
| `--out <path>`          | Output path (default `supabase/seed.sql`).                    |
| `--report`              | Print how each column resolves (see [Honest generation](#honest-generation)). |
| `--faker`               | Use the optional Faker provider (requires `@faker-js/faker`). |

> [!NOTE]
> Columns with a database default (e.g. `created_at default now()`) or that are
> database-generated are intentionally **omitted** from `seed.sql`, so the database fills
> them on load. This keeps the file deterministic — re-running with the same `--seed`
> produces a **byte-identical** file (clean git diffs).

## How a column is resolved

For every column the engine walks this priority order and uses the first match:

1. **Override** — an explicit generator you supplied for that column.
2. **Primary key** — always generated and unique (so foreign keys can reference it).
3. **Skipped** — `generated` columns and columns with a `DEFAULT` are left for the database.
4. **Foreign key** — a random existing primary key from the referenced table.
5. **Enum** — a random value from the enum's declared values.
6. **Semantic name** — inferred from the column name (`email`, `avatar_url`, `price`…).
7. **Type fallback** — a value matching the raw column type.

Not sure what a column will get? Run `fakebase seed gen --report` and it tells you, per
column, before generating anything.

### Semantic name mappings (built-in provider)

The built-in provider recognizes these column-name patterns (case-insensitive, matched on
word/underscore boundaries so `total` matches `order_total` but not `totally`):

| Column name contains                                   | Generates                  |
| ------------------------------------------------------ | -------------------------- |
| `email`                                                | an email address           |
| `first_name` / `given_name`                            | a first name               |
| `last_name` / `surname` / `family_name`                | a last name                |
| `username` / `handle` / `login`                        | a handle                   |
| `name` / `full_name` / `display_name`                  | a full name                |
| `avatar` / `photo` / `picture` / `image_url` / `thumbnail` | an avatar URL          |
| `url` / `website` / `homepage` / `link` / `href`       | a URL                      |
| `slug`                                                 | a slug                     |
| `title` / `headline` / `subject`                       | a short title              |
| `description` / `bio` / `summary` / `content` / `body` | a sentence                 |
| `phone` / `mobile` / `tel`                             | a phone number             |
| `city`, `country`, `color`                             | a city / country / color   |
| `price` / `amount` / `cost` / `total` / `balance` / `salary` / `fee` | a money value |
| `age`                                                  | 18–80                      |
| `quantity` / `count` / `qty` / `stock`                 | a small integer            |
| `created_at` / `updated_at` / `*_at` / `*_date`        | a past date                |

Anything without a match falls back to the column's raw type — that's not an error, just a
generic value. Override it (below) if you want something specific.

### Type fallbacks

| Column type            | Generates                          |
| ---------------------- | ---------------------------------- |
| `text` / `varchar`     | a few lorem words                  |
| `int4` / `int8`        | an integer                         |
| `float4`/`float8`/`numeric` | a decimal                     |
| `bool`                 | true / false                       |
| `uuid`                 | a v4 UUID                          |
| `timestamptz`/`timestamp` | an ISO timestamp                |
| `date`                 | an ISO date                        |
| `jsonb` / `json`       | a small object                     |

## Overrides — convention to control

Inference is convention-first; override any column when you need exact control. Override
keys are `table.column` or `schema.table.column`, and the function receives the
partially-built row:

```ts
await seedClient(supabase, schema, {
  rowsPerTable: 20,
  overrides: {
    "users.bio": () => "Indie hacker. Building in public.",
    "posts.slug": (row) => slugify(row.title as string),
  },
});
```

## Determinism

Output is deterministic by default. The same schema and `seed` produce identical rows
every run — stable reloads, clean git diffs.

```ts
import { generateRows } from "@byronwade/seed";
generateRows(schema, { seed: 12345 }); // identical every time
```

Change the seed to reroll. `fakebase seed gen` writes a byte-identical `seed.sql` on every
run (no timestamp header), so regenerating produces a clean, empty git diff unless the data
actually changed.

## Using the Faker provider

For richer values and locale support, install Faker (**v9.1+**) and the wrapper, then pass
the provider:

```bash
pnpm add -D @faker-js/faker @byronwade/seed-faker
```

```ts
import { faker } from "@faker-js/faker";
import { createFakerProvider } from "@byronwade/seed-faker";

await seedClient(supabase, schema, {
  rowsPerTable: 20,
  provider: createFakerProvider(faker),
});
```

From the CLI, just add `--faker` (it loads your installed `@faker-js/faker`):

```bash
fakebase seed gen --rows 20 --faker
```

You can also write your own provider — anything implementing the `DataProvider` interface
(`seed`, `forType`, `forName`) works.

## Honest generation

In keeping with Fakebase's "no silent gaps" approach, `--report` (or
`describeResolution()` in code) shows exactly how each column is resolved, so a fall-back
to a raw type default is visible rather than hidden:

```
$ fakebase seed gen --report
  users.id         → primary-key
  users.email      → semantic
  users.created_at → skipped (default now())
  posts.author_id  → foreign-key (→ users.id)
  posts.status     → enum (post_status)
  posts.view_count → semantic
```

## Configuration

Set defaults in your `fakebase` config so the CLI and team share them:

```ts
{
  seedGen: {
    rowsPerTable: 20,
    tables: { posts: 100, comments: 300 },
    seed: 12345,
    nullRate: 0.05, // 5% of nullable columns get null
  }
}
```

CLI flags override config values; config overrides the built-in defaults (10 rows, seed 0,
nullRate 0).

## Troubleshooting

| Symptom                                                   | Cause                                                        | Fix                                                                 |
| --------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| `No tables found in your schema.`                         | The CLI found no `fakebase/schema.ts` and no SQL migrations. | Create a schema (`fakebase init`) or add migrations under `supabase/migrations/`. |
| `seedClient` did nothing on the second run                | It's **idempotent** — tables with existing rows are skipped. | Pass `{ force: true }`, or start from a fresh/empty kernel.          |
| Data changes every time I restart the dev server          | The **memory** adapter is in-process; each restart is empty and re-seeds. | Expected. Use `createJsonKernel` / `createSqliteKernel` for persistence. |
| Error mentioning `fs` / `crypto` / "server only"          | Seeding ran in the browser / a client component.            | Move it to a server module (add `import "server-only"`).            |
| `--faker` fails                                           | `@faker-js/faker` (v9.1+) isn't installed.                  | `pnpm add -D @faker-js/faker`.                                       |
| An enum column got lorem text instead of enum values      | The enum isn't in the schema (so it falls back to type).    | Define the enum: TS DSL `enums`, or `CREATE TYPE … AS ENUM` in SQL. |
| A foreign-key column is unexpectedly `null`               | The parent table generated 0 rows, or it's a required FK cycle. | Give the parent rows; make one side of a cycle nullable.        |
| Inserts fail with a policy/RLS error                      | You changed the kernel role away from the default `service_role`. | Seed before switching roles, or `kernel.setRole({ role: "service_role" })` first. |
| `seed.sql` is missing `created_at` / other defaulted cols | Intentional — defaulted/generated columns are left for the DB. | Nothing to fix; the database fills them. Override the column to force a value. |
| Two people get different data from the same schema        | Different `seed` (or different `rowsPerTable`/schema).       | Pin `seed` in your `fakebase` config so everyone matches.           |

## FAQ

**Do I have to install Faker?** No. The built-in provider is the default and needs no extra
dependency. Faker is opt-in for richer data.

**Is it safe to call `seedClient` on every request/boot?** Yes — it skips tables that already
have rows. Call it once at module scope in your server-only `lib/fakebase.ts`.

**Will it overwrite my real data?** It only ever **inserts**, and skips non-empty tables
unless you pass `force: true`. It is a dev/prototype tool — never point it at production.

**Can I generate realistic relationships (e.g. 3–7 posts per user)?** Not yet — v1 assigns
foreign keys uniformly at random. Each child row references a random existing parent.

**How do I get the same data as a teammate?** Use the same `seed` (set `seedGen.seed` in
config). Same schema + same seed ⇒ identical rows.

## Constraints & limitations

- **Unique** columns are kept distinct (bounded collision-retry).
- **Nullable** columns can be set to null via `nullRate`.
- **Foreign keys** always reference a real parent row; a nullable FK with no available
  parent becomes `null`.
- **Reference cycles** are tolerated — the cyclic edge is filled with `null` on first
  insert, so a *required* FK cycle cannot be fully satisfied (make one side nullable).
- Enum columns require the enum to be present in the schema. When your schema comes from
  SQL migrations, `CREATE TYPE … AS ENUM` is parsed automatically.

## The export path

Generated data flows straight to a real Supabase project: `fakebase seed gen` writes
`supabase/seed.sql`, which Supabase loads on `supabase db reset` / `db push`. See the
[migration guide](./migration-guide.md) for the full local-to-production path.
