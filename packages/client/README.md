# `@byronwade/client`

> Part of [**Fakebase**](https://github.com/byronwade/fakebase) — a Supabase-shaped, **local/dev-only** development platform for Next.js prototypes. Not for production use.

The Supabase-shaped client facades (`auth`, `storage`, `realtime`, `functions`) and the chainable query `DatabaseBuilder` that sit on top of a Fakebase kernel. Most apps consume this through the top-level `fakebase` package.

## Installation

```bash
pnpm add fakebase
```

This package ships with `fakebase` and is published as `@byronwade/client`.

## Usage

```ts
import { createClient } from "@byronwade/client";
import { createMemoryKernel } from "@byronwade/adapter-memory";

const kernel = createMemoryKernel();
const db = createClient("http://localhost", "anon-key", { kernel });

const { data } = await db.from("posts").select("id, title").limit(10);
```

## What's inside

- `createClient` — assembles a `FakebaseClient` from a kernel (the `url`/`key` args exist only for API parity).
- `DatabaseBuilder` — the chainable PostgREST-style query builder.
- Facade factories: `createAuthClient`, `createStorageClient`, `createRealtimeClient` (+ `Channel`), `createFunctionsClient`.
- Types: `FakebaseClient`, `FakebaseClientOptions`, `FakebaseResponse`, and the `*Facade` interfaces.

## Documentation

- [Project README](https://github.com/byronwade/fakebase#readme)
- [Architecture](https://github.com/byronwade/fakebase/blob/main/docs/architecture.md)
- [Compatibility matrix](https://github.com/byronwade/fakebase/blob/main/docs/compatibility-matrix.md)

## License

MIT
