# `@fakebase/adapter-memory`

> Part of [**Fakebase**](https://github.com/byronwade/fakebase) — a Supabase-shaped, **local/dev-only** development platform for Next.js prototypes. Not for production use.

The zero-setup, in-memory adapter — the default backing store for local dev. Data lives entirely in-process and resets when the process exits, which makes it perfect for tests and quick prototypes.

## Installation

```bash
pnpm add fakebase
```

This package ships with `fakebase` and is published as `@fakebase/adapter-memory`.

## Usage

```ts
import { createClient } from "fakebase";
import { createMemoryKernel } from "@fakebase/adapter-memory";

const kernel = createMemoryKernel(); // optionally pass a ProjectSchemaIR
const db = createClient("http://localhost", "anon-key", { kernel });
```

## What's inside

- `createMemoryKernel(schema?)` — builds a fully wired kernel (data + auth + storage) in one call.
- `MemoryAdapter` — the raw `FakebaseAdapter` implementation if you want to assemble a kernel yourself.

State is **not** persisted across restarts — use `@fakebase/adapter-json` or `@fakebase/adapter-sqlite` for durability.

## Documentation

- [Project README](https://github.com/byronwade/fakebase#readme)
- [Architecture](https://github.com/byronwade/fakebase/blob/main/docs/architecture.md)
- [Compatibility matrix](https://github.com/byronwade/fakebase/blob/main/docs/compatibility-matrix.md)

## License

MIT
