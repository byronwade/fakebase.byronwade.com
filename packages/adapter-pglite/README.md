# @fakebase/adapter-pglite

PGlite (Postgres-in-WASM) adapter for [Fakebase](https://github.com/byronwade/fakebase) — the **highest-fidelity** local backend.

[PGlite](https://pglite.dev) embeds a real Postgres engine compiled to WebAssembly, so you get true Postgres semantics (the real parser, planner, `jsonb`, `ilike`, window functions, ordering with `NULLS FIRST/LAST`, …) with **no native build step**. Unlike `better-sqlite3`, it runs identically on macOS, Linux, and Windows, and in CI, without `node-gyp`.

> ⚠️ Fakebase is a **local / dev-only** tool for prototypes. It is not production infrastructure. See the [security notes](https://github.com/byronwade/fakebase/blob/main/docs/security.md).

## Install

```bash
pnpm add @fakebase/adapter-pglite @fakebase/client
```

`@electric-sql/pglite` is bundled as a direct dependency — there's nothing else to install.

## Usage

```ts
import { createPGliteKernel } from "@fakebase/adapter-pglite";
import { createClient } from "@fakebase/client";
import { schema } from "./fakebase/schema";

// In-memory (great for tests): omit `dataDir`, or pass "memory://".
// Durable: pass a filesystem directory.
const kernel = createPGliteKernel({ schema, dataDir: ".fakebase/pg" });
const supabase = createClient(kernel);

const { data } = await supabase.from("notes").select("*");
```

`createPGliteKernel` is synchronous and mirrors `createMemoryKernel` /
`createSqliteKernel`. The WASM Postgres boots lazily; the **first query awaits
readiness** automatically, so you never need to `await` construction.

## When to choose this adapter

| Adapter                        | Backing store       | Native build     | Best for                                      |
| ------------------------------ | ------------------- | ---------------- | --------------------------------------------- |
| `@fakebase/adapter-memory`     | JS objects          | none             | unit tests, throwaway demos                   |
| `@fakebase/adapter-json`       | JSON files          | none             | small durable prototypes, git-diffable data   |
| `@fakebase/adapter-sqlite`     | SQLite (WAL)        | `better-sqlite3` | durable single-file persistence               |
| **`@fakebase/adapter-pglite`** | **Postgres (WASM)** | **none**         | **maximum SQL fidelity before real Supabase** |

## Behaviour & parity notes

To keep behaviour **identical across all adapters** (verified by the shared
contract suite in `@fakebase/test-utils`):

- **RLS** is evaluated in JS via the shared `PolicyEngine` (not Postgres roles),
  matching the other adapters. It is an approximation — verify against real
  Postgres before relying on it.
- **`uuid` and temporal columns are stored as `text`**, so the adapter accepts
  the same lenient values as the others (e.g. non-UUID string ids, verbatim ISO
  timestamps).
- **Column defaults** (`gen_random_uuid()`, `now()`, literals) are applied in JS
  at insert time; foreign-key constraints are omitted.
- `jsonb`/`json` and `boolean` use their **native Postgres types** and round-trip
  losslessly.
- `rpc()` on the adapter throws a `CapabilityError`; database functions are
  served by the kernel's local function registry.

## API

- `class PGliteAdapter implements FakebaseAdapter` — constructor takes
  `{ dataDir?: string }` (filesystem path, `"memory://"`, or omit for in-memory).
- `createPGliteKernel({ dataDir?, schema?, storageDir? })` — a fully wired kernel
  (data + auth + storage + realtime + functions).

## License

MIT
