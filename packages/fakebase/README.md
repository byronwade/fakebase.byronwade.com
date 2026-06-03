# `fakebase`

> Part of [**Fakebase**](https://github.com/byronwade/fakebase) — a Supabase-shaped, **local/dev-only** development platform for Next.js prototypes. Not for production use.

The main entry point. A drop-in-shaped replacement for `@supabase/supabase-js` that bundles the kernel, client, in-memory adapter, and local auth so you can swap a single import and keep building against a fake backend.

## Installation

```bash
pnpm add fakebase
```

## Usage

```ts
import { createClient, createMemoryKernel } from "fakebase";

const kernel = createMemoryKernel({ tables: [], enums: [], functions: [], version: 0 });
const db = createClient("http://localhost", "anon-key", { kernel });

const { data, error } = await db.from("users").select("*").eq("role", "admin");
```

## What's inside

- `createClient` — the Supabase-shaped client (re-exported from `@fakebase/client`).
- `createMemoryKernel` — a zero-setup in-memory kernel (from `@fakebase/adapter-memory`).
- `fakebase/next` — SSR helpers `createServerClient` / `createBrowserClient` that mirror `@supabase/ssr`.
- Re-exported types: `FakebaseClient`, `FakebaseClientOptions`, `FakebaseKernel`, `ProjectSchemaIR`, `TableIR`, `ColumnIR`, `LocalSession`, `LocalUser`, `AuthStateChangeEvent`.

The client and kernel rely on Node built-ins, so use them in **server** code (Route Handlers, Server Components, server actions) — not the browser bundle.

## Documentation

- [Project README](https://github.com/byronwade/fakebase#readme)
- [Architecture](https://github.com/byronwade/fakebase/blob/main/docs/architecture.md)
- [Compatibility matrix](https://github.com/byronwade/fakebase/blob/main/docs/compatibility-matrix.md)

## License

MIT
