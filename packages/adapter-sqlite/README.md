# `@fakebase/adapter-sqlite`

> Part of [**Fakebase**](https://github.com/byronwade/fakebase) — a Supabase-shaped, **local/dev-only** development platform for Next.js prototypes. Not for production use.

A durable, single-file SQLite adapter (WAL mode) backed by `better-sqlite3`. The most production-like local option when you want realistic, durable persistence for your prototype.

## Installation

```bash
pnpm add @fakebase/adapter-sqlite
```

Install this optional adapter directly; it pulls in the native `better-sqlite3` dependency and is not bundled with `fakebase`.

## Usage

```ts
import { createClient } from "fakebase";
import { createSqliteKernel } from "@fakebase/adapter-sqlite";

const kernel = createSqliteKernel({ dbPath: ".fakebase/fakebase.db" });
const db = createClient("http://localhost", "anon-key", { kernel });
```

## What's inside

- `createSqliteKernel({ dbPath?, schema?, storageDir? })` — a fully wired SQLite-backed kernel (data + auth + storage).
- `SqliteAdapter` — the raw adapter, plus type `CreateSqliteKernelOptions`.
- Type-mapping helpers: `mapColumnType`, `serializeValue`, `deserializeValue`.

Dev-only — durable for local work, not a production database.

## Documentation

- [Project README](https://github.com/byronwade/fakebase#readme)
- [Architecture](https://github.com/byronwade/fakebase/blob/main/docs/architecture.md)
- [Compatibility matrix](https://github.com/byronwade/fakebase/blob/main/docs/compatibility-matrix.md)

## License

MIT
