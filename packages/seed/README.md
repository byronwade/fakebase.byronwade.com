# @byronwade/seed

Schema-driven fake data generation for [Fakebase](https://github.com/byronwade/fakebase).
Generate realistic, **referentially-correct, deterministic** rows straight from your
schema — no hand-written seed files.

```bash
pnpm add @byronwade/seed
```

```ts
import { seedClient } from "@byronwade/seed";

// Idempotent — skips tables that already have rows.
await seedClient(supabase, schema, { rowsPerTable: 20 });
```

- **Foreign-key correct** — children reference real parent rows; inserts run in FK order.
- **Deterministic** — same `seed` ⇒ identical data (stable reloads, clean diffs).
- **Convention-first** — column type + name inference (`email`, `avatar_url`, `price`…),
  with per-column overrides when you need control.
- **Honest** — `describeResolution()` shows how every column resolves.
- **Pluggable** — zero-dependency built-in provider; install
  [`@byronwade/seed-faker`](../seed-faker) for `@faker-js/faker` data and locales.

Exports: `seedClient`, `generateRows`, `describeResolution`, `createBuiltinProvider`,
`orderTables`, `createRng`, and the `DataProvider` interface.

Full guide: **[docs/seeding.md](../../docs/seeding.md)**.

> Dev/prototype tool — not production infrastructure.
