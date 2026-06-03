# Schema-Driven Fake Data Generation (`@fakebase/seed`) — Design

**Date:** 2026-06-02
**Status:** Implemented
**Author:** Byron Wade (with Claude)
**Builds on:** the existing schema IR (`packages/core/src/schema/ir.ts`), kernel adapters, and the `fakebase seed export` path.

## Implementation notes (what shipped, and deviations)

Built TDD across `@fakebase/seed` (engine + built-in provider), `@fakebase/seed-faker`
(optional Faker provider), CLI `fakebase seed gen`, and docs. 44 new package tests + 1 in
migrations; full workspace test/typecheck/lint green. Two deliberate deviations from the
design above, both surfaced by an end-to-end smoke test:

1. **CLI exports directly from `generateRows`, not via a kernel.** Routing through a kernel
   re-applied `DEFAULT now()` on insert, baking non-deterministic timestamps into
   `seed.sql`. Exporting `generateRows` output directly (which omits defaulted/generated
   columns) preserves the determinism guarantee; the database fills defaults on load.
2. **Extended `parseSqlSchema` to parse `CREATE TYPE … AS ENUM`.** It previously returned
   `enums: []`, so enum columns from SQL-migration schemas degraded to text. Now enums are
   extracted, so the engine assigns valid enum values. (Also benefits type-gen.)

Also fixed a semantic over-match (the `total` price keyword matched `totally`) by anchoring
keyword patterns to word/underscore boundaries. `@fakebase/seed-faker` is bundled as a CLI
dependency (it is itself faker-free), so `--faker` only requires the user to add
`@faker-js/faker`.

**Post-review hardening (advisor pass).** The Faker provider was initially only tested
against a self-authored stub. Added an integration test against real `@faker-js/faker`
(v10), which caught two version-API bugs the stub masked: `faker.internet.avatar()` was
removed (→ `faker.image.avatar()`), and `faker.date.past()` defaults its reference to *now*
(non-deterministic → pinned a fixed `refDate`). Pinned `peerDependencies` to `>=9.1` (where
`image.avatar` + lowercase `internet.username` are both present) and added a
`loadFakerProvider()` test. Finally, `exportSeedSql` gained a `{ timestamp: false }` option
(used by `seed gen`) so regenerated `seed.sql` is byte-identical run-to-run — the "clean
diffs" promise now holds literally. Changeset added for the two new packages.

## Goal

Today, populating a Fakebase prototype means hand-writing `fakebase/seeds/seed.ts` and calling
`client.from(...).insert(...)` row by row. That is exactly the repetitive, re-do-it-every-time-the-schema-changes
work Fakebase exists to eliminate — especially when iterating fast with AI.

This feature generates **realistic, referentially-correct fake data directly from the schema IR**,
with no seed-writing. The same engine powers two surfaces: instant runtime auto-seed (the magic
moment) and a deterministic CLI `seed gen` that exports to real `supabase/seed.sql`.

## Decisions (locked with user)

- **One engine, two entry points.** A single pure generator core, exposed both at **runtime**
  (auto-fill the kernel) and via the **CLI** (write a reusable/exportable seed). Both are thin
  wrappers over the same core.
- **Convention-first with optional overrides.** Smart inference by default (type + column name);
  an optional per-column override map for full control. FKs, enums, and `unique` are honored
  automatically.
- **Built-in generator + pluggable provider (NOT a hard Faker dependency).** `@fakebase/seed`
  ships a small, zero-dependency built-in data vocabulary as the default. `@faker-js/faker` is an
  **optional, drop-in provider** — never a dependency of the core package. This mirrors the
  storage adapter model: "pick your fidelity" for data, just like for persistence.
- **Deterministic by default.** A fixed RNG seed produces byte-identical data across runs (stable
  reloads, reviewable diffs). Override the seed to reroll.
- **Honest generation.** A `--report` flag / runtime debug log shows how each column was resolved
  (override / FK / enum / semantic / type-fallback), consistent with the `CapabilityError` ethos —
  nothing is silently mis-generated.

## Architecture

A **new package**, `@fakebase/seed` (`packages/seed/`), keeps `@faker-js/faker` out of the lean
core entirely. You opt in by installing `@fakebase/seed`; base `fakebase` stays small and
edge/serverless-friendly.

```
packages/seed/
  src/
    generate.ts     # generateRows(schema, options): Record<"schema.table", Row[]>  — pure, deterministic
    resolve.ts      # per-column generator resolution (priority chain below)
    provider.ts     # DataProvider interface + the built-in zero-dep provider
    semantic.ts     # column-name → generator dictionary (email, avatar_url, first_name, price, …)
    order.ts        # topological table sort by FK references (+ cycle handling)
    seedClient.ts   # seedClient(client, schema, options) — generates + inserts in FK-safe order
    index.ts        # public exports
  __tests__/
```

An **optional companion package**, `@fakebase/seed-faker` (`packages/seed-faker/`), is a tiny
wrapper that adapts `@faker-js/faker` to the `DataProvider` interface and declares Faker as its
own (isolated) dependency. People who never install it pay nothing.

### The provider boundary (why "build our own faker" is bounded)

The valuable engine logic is **provider-independent**. The provider only supplies *leaf value
vocabulary*; everything that makes data *correct* stays in the engine.

```ts
export interface DataProvider {
  /** Seed the provider's RNG for deterministic output. */
  seed(n: number): void;
  /** A generator for a raw column type (the type fallback). */
  forType(type: ColumnType): () => unknown;
  /** A generator inferred from a column name, or null if no semantic match. */
  forName(name: string, type: ColumnType): (() => unknown) | null;
}
```

- **Built-in provider** (default, in `@fakebase/seed`): a few KB of curated pools — first/last
  names, lorem words, email domains, cities, slugs, plus type mappers. No external dependency.
- **Faker provider** (`@fakebase/seed-faker`): maps `forType` / `forName` to Faker modules.

We build our own *vocabulary* (small, in-house), **not** a second engine around it. Faker drops
in when someone wants more breadth/locales.

## Generation pipeline

1. **Topological sort** tables by `ColumnIR.references` (parents before children). Cycle handling:
   nullable FK → `null` on first pass; required cyclic FK → emit a warning and skip the cyclic
   edge (documented limitation).
2. For each table, generate `rowsPerTable` rows (per-table overrides allowed).
3. For each column, resolve a value generator in **priority order**:
   1. **Override** — `overrides["public.users.bio"]` (or `"users.bio"`) if provided.
   2. **Skip** — `generated` columns and columns with `defaultSql` are left for the kernel to fill,
      **except** primary-key UUIDs, which we generate so FKs can reference them.
   3. **FK** (`references`) → pick a random existing PK from the already-generated parent rows →
      referential integrity. Respect `nullable` (occasional `null`).
   4. **Enum** (type matches an `EnumIR`) → random pick from `enum.values`.
   5. **Semantic name** → `provider.forName(name, type)` (e.g. `email`, `avatar_url`,
      `first_name`, `price`, `created_at`).
   6. **Type fallback** → `provider.forType(type)`.
4. **Constraints honored:** `unique` → per-column collision-retry (bounded, then warn);
   `nullable` → small configurable null rate; PK uniqueness guaranteed.
5. **Determinism:** `provider.seed(configSeed)` once up front. Same schema + same seed ⇒ identical
   output.

`generateRows` is **pure** (schema + options in, rows out) — no I/O, trivially testable.

## Entry points

### Runtime (instant dev data)

```ts
// lib/fakebase.ts
import { seedClient } from "@fakebase/seed";

export const supabase = createClient("local", "dev-key", { kernel });

// Idempotent: skips tables that already have rows, so it's safe to call on every boot.
await seedClient(supabase, schema, { rowsPerTable: 20 });
```

For per-visitor playground kernels, call `seedClient` right after the kernel is created.

### CLI (deterministic, exportable)

```
fakebase seed gen [--rows N] [--table posts:100] [--seed 12345] [--report] [--faker]
```

- Generates rows → inserts into a kernel → reuses the **existing `exportSeedSql`** to write
  `supabase/seed.sql`.
- `--report` prints the per-column resolution table.
- `--faker` uses `@fakebase/seed-faker` if installed (else a clear, actionable error — honest
  capabilities).
- Optionally also writes an editable `fakebase/seeds/seed.generated.ts`.

## Config & overrides

Counts and seed live in `fakebase` config; function overrides live in code (a function can't be
serialized to JSON config):

```ts
// fakebase config
seed: {
  rowsPerTable: 20,
  tables: { posts: 100, comments: 300 },
  seed: 12345,
  nullRate: 0.05,
}

// fakebase/seeds/generators.ts  (imported by the CLI / passed at runtime)
export const overrides = {
  "users.bio": () => "Indie hacker. Building in public.",
  "posts.slug": (row) => slugify(row.title), // receives the partially-built row
};
export const provider = fakerProvider; // optional
```

## Non-goals (YAGNI for v1)

- Weighted / realistic statistical distributions.
- Locale configuration (Faker provider covers this for those who need it).
- Relationship **cardinality** control ("each user has 3–7 posts") — v1 ships uniform-random FK
  assignment; cardinality can be added later if it earns its place.

## Testing

`generateRows` purity makes the suite straightforward:

- FK insert ordering (topological correctness) and cycle handling.
- Referential integrity (every FK value exists in the parent).
- `unique` collision-retry; PK uniqueness.
- Enum values always valid; `nullable` null-rate within tolerance.
- **Determinism**: same seed ⇒ byte-identical rows; different seed ⇒ different rows.
- Provider swap: built-in vs a stub Faker provider produce structurally valid rows.
- Resolution priority order (override beats FK beats enum beats semantic beats type).

## Documentation & usability (notated for every surface)

A new **`docs/seeding.md`** is the home of this feature, cross-linked from the existing docs and
the marketing site. It documents the *usability* of every surface, not just the API:

- **Overview & mental model** — "pick your fidelity for data," mirroring the storage adapters;
  when to use runtime auto-seed vs CLI seed gen.
- **Quick start (runtime)** — the three-line `seedClient` snippet; idempotency behavior; where to
  call it (app bootstrap; per-visitor kernels).
- **Quick start (CLI)** — `fakebase seed gen` flags, output locations, exporting to
  `supabase/seed.sql`, and the `--report` output explained with a sample table.
- **How resolution works** — the priority chain, with a worked example schema → generated rows,
  so users can predict what each column will get.
- **Semantic mappings reference** — the full built-in column-name dictionary (which names map to
  which generators), so inference is never a black box.
- **Type fallback reference** — `ColumnType` → default generator table.
- **Overrides** — convention-to-control: how to override a column, FK-derived values, and
  per-table counts; copy-paste `generators.ts` example.
- **Determinism** — what the seed controls, how to reroll, and why diffs stay stable.
- **Using the Faker provider** — installing `@fakebase/seed-faker`, wiring it at runtime and via
  `--faker`, and what you gain (breadth, locales).
- **Constraints & honesty** — how `unique`, `nullable`, `generated`, `defaultSql`, enums, and FKs
  are handled; documented limitations (required FK cycles); the `--report`/debug visibility story.
- **Export path** — how generated data flows into `supabase/seed.sql` and onward to a real
  Supabase project (ties into `docs/migration-guide.md`).

**Cross-links to update for usability:**

- `docs/getting-started.md` — add a "populate it with fake data" step after schema definition.
- `docs/cli.md` — document `seed gen` alongside the existing seed commands.
- `docs/compatibility-matrix.md` — add a "Seed/fake data" row.
- `README.md` — a short bullet under "Why Fakebase?" + a one-liner in the quick start.
- Marketing site (`apps/web`) — a value-prop / how-it-works mention (optional, follow-up).

Every public function, the `DataProvider` interface, CLI flags, and config keys carry doc
comments; the docs above are the human-facing companion to those.

## Open questions for review

1. Package naming: `@fakebase/seed` + `@fakebase/seed-faker` — good, or prefer
   `@fakebase/faker` / a `seed/` subpath export?
2. Default `rowsPerTable` — 20 a sensible default?
3. Should runtime `seedClient` be opt-in only, or should `fakebase init` scaffold the call
   (commented out) so it's discoverable?
