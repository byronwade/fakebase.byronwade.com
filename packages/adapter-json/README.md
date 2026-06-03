# `@byronwade/adapter-json`

> Part of [**Fakebase**](https://github.com/byronwade/fakebase) — a Supabase-shaped, **local/dev-only** development platform for Next.js prototypes. Not for production use.

A file-backed JSON adapter. Each table is persisted as a JSON file under `.fakebase/` (synchronously flushed on every write), so your prototype data survives restarts while staying easy to inspect and diff.

## Installation

```bash
pnpm add @byronwade/adapter-json
```

Install this optional adapter directly; it is not bundled with the top-level `fakebase` package.

## Usage

```ts
import { createClient } from "@byronwade/fakebase";
import { createJsonKernel } from "@byronwade/adapter-json";

const kernel = createJsonKernel({ dir: ".fakebase" });
const db = createClient("http://localhost", "anon-key", { kernel });
```

## What's inside

- `createJsonKernel({ dir?, schema? })` — a kernel that reads/writes JSON files (under `<dir>/data`).
- `JsonAdapter` — the raw adapter, plus type `JsonAdapterOptions`.

Dev-only persistence — fine for prototypes, not a production datastore.

## Documentation

- [Project README](https://github.com/byronwade/fakebase#readme)
- [Architecture](https://github.com/byronwade/fakebase/blob/main/docs/architecture.md)
- [Compatibility matrix](https://github.com/byronwade/fakebase/blob/main/docs/compatibility-matrix.md)

## License

MIT
