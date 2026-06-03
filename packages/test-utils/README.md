# `@fakebase/test-utils`

> Part of [**Fakebase**](https://github.com/byronwade/fakebase) — a Supabase-shaped, **local/dev-only** development platform for Next.js prototypes. Not for production use.

The contract-test harness for Fakebase adapters and Supabase-compatibility checks. Ships shared schema/seed fixtures, a reusable adapter contract suite, and a compat runner that diffs Fakebase behavior against a Supabase-like client.

## Installation

```bash
pnpm add -D @fakebase/test-utils
```

Requires `vitest` (peer dependency).

## Usage

```ts
import { defineAdapterContractSuite } from "@fakebase/test-utils";
import { MemoryAdapter } from "@fakebase/adapter-memory";

defineAdapterContractSuite("memory", async () => new MemoryAdapter());
```

## What's inside

- `defineAdapterContractSuite(name, createAdapter, teardown?)` — drops a full adapter contract suite into your Vitest run.
- `runCompatSuite(scenarios, fakebaseClient, supabaseClient?)` + `DEFAULT_COMPAT_SCENARIOS`.
- Fixtures: `TEST_SCHEMA`, `TEST_SEEDS`.
- Subpath entry points: `@fakebase/test-utils/compat` and `@fakebase/test-utils/fixtures`.

## Documentation

- [Project README](https://github.com/byronwade/fakebase#readme)
- [Architecture](https://github.com/byronwade/fakebase/blob/main/docs/architecture.md)
- [Compatibility matrix](https://github.com/byronwade/fakebase/blob/main/docs/compatibility-matrix.md)

## License

MIT
