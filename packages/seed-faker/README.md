# @byronwade/seed-faker

An optional [`@faker-js/faker`](https://fakerjs.dev) data provider for
[`@byronwade/seed`](../seed) — richer fake data and locale support.

This package has **no hard dependency on Faker**; you pass your own instance in, so the
version and locale are entirely yours.

```bash
pnpm add -D @faker-js/faker @byronwade/seed-faker
```

```ts
import { faker } from "@faker-js/faker";
import { createFakerProvider } from "@byronwade/seed-faker";
import { seedClient } from "@byronwade/seed";

await seedClient(supabase, schema, {
  rowsPerTable: 20,
  provider: createFakerProvider(faker),
});
```

From the Fakebase CLI, just add `--faker`:

```bash
fakebase seed gen --rows 20 --faker
```

The engine (FK integrity, enums, unique/nullable, determinism) is unchanged — this only
swaps the leaf-value vocabulary. Full guide: **[docs/seeding.md](../../docs/seeding.md)**.

> Dev/prototype tool — not production infrastructure.
