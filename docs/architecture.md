# Architecture

Fakebase is a TypeScript monorepo built around a single idea: **keep the Supabase developer
contract stable while swapping the implementation underneath.** The compatibility logic lives in
one place (`@byronwade/core`), and everything user-facing — the client, CLI, admin UI, and AI
tooling — sits on top of it.

```
Next.js app
   │
   ▼
fakebase.createClient(url, key, { kernel })      ← Supabase-shaped facade (@byronwade/client)
   │  from() · auth · storage · realtime · functions · rpc
   ▼
FakebaseKernel                                   ← orchestrator (@byronwade/core)
   ├── schema registry (normalized IR)
   ├── query compiler (plan → adapter ops)
   ├── policy engine (grants + RLS predicates)
   ├── auth engine        (@byronwade/auth)
   ├── storage engine     (@byronwade/storage)
   ├── realtime event bus (@byronwade/realtime)
   ├── function registry  (@byronwade/functions)
   ├── capability registry (structured errors)
   └── adapter interface
          ├── adapter-memory   (Map store, zero setup)
          ├── adapter-json     (.fakebase/ snapshots)
          └── adapter-sqlite   (durable, WAL)
```

## Layers of fidelity

Fakebase explicitly promises only the first two of three fidelity layers:

1. **API-shape fidelity** — method names, chaining, and `{ data, error }` envelopes match
   `@supabase/supabase-js`. _Promised._
2. **Behavior fidelity** — insert/select/update/filter/session/storage semantics behave like
   Supabase for the common cases. _Promised for supported capabilities._
3. **Infrastructure fidelity** — true PostgreSQL planner semantics, true RLS enforcement, true
   edge routing, true PITR. _Explicitly not promised._ This is why Fakebase is dev-only.

## The kernel

`FakebaseKernel<Database>` is the central orchestrator. It is constructed **synchronously** via a
factory (`createMemoryKernel`, `createJsonKernel`, `createSqliteKernel`) so it can be used directly
in module scope, Server Components, and Route Handlers without an async bootstrap step.

The kernel owns:

- **Schema IR** — a normalized in-memory representation (`ProjectSchemaIR` → `TableIR`, `ColumnIR`,
  `PolicyIR`, `EnumIR`, `FunctionIR`). Both the TypeScript schema DSL and SQL migrations normalize
  into this single shape.
- **Query compiler** — translates a builder chain into a `QueryPlan` (filters, ordering, range,
  projection) and executes it against the adapter, applying policy predicates.
- **Policy engine** — compiles `USING` / `WITH CHECK` expressions into JavaScript predicates over
  `(row, context)` and enforces grants for the `anon`, `authenticated`, and `service_role` roles.
- **Engines** — auth, storage, realtime, and functions are interfaces the kernel exposes; the
  facade package wraps them in the Supabase-shaped client API.
- **Capability registry** — every feature is registered with a `CapabilityStatus`
  (`SUPPORTED` / `PARTIAL` / `STUB` / `UNSUPPORTED`). Calling an unsupported feature throws a
  `CapabilityError` with a docs link instead of silently doing nothing.

## Adapter contract

Adapters implement a single persistence interface and are interchangeable without touching app
code. They share these traits:

- **Synchronous init** via a factory; state is loaded eagerly.
- **`Filter[]`-based** read/update/delete so the query compiler stays adapter-agnostic.
- **RLS-aware reads** — the adapter receives the compiled policy context.
- **`exportData()` / `importData()`** for snapshots, seeds, and cross-adapter migration.

| Adapter          | Setup                               | Durability             | Best for                                |
| ---------------- | ----------------------------------- | ---------------------- | --------------------------------------- |
| `adapter-memory` | none                                | none (process)         | tests, disposable prototypes            |
| `adapter-json`   | none                                | `.fakebase/` files     | small prototypes, seeds, manual editing |
| `adapter-sqlite` | low (`better-sqlite3` native build) | single-file (WAL)      | serious local projects                  |
| `adapter-pglite` | none (pure WASM)                    | directory or in-memory | highest SQL fidelity, cross-platform/CI |

`adapter-pglite` runs a real Postgres engine compiled to WebAssembly, so it offers the highest
SQL fidelity with no native build. Every adapter is verified against the **same** behavioural
contract suite in `@byronwade/test-utils`, so swapping the persistence layer never changes
observable behaviour.

## Error model

All errors normalize to a `FakebaseError` with a stable `code`. `CapabilityError` is a subclass
used for unsupported/stubbed features; it carries the capability name and a documentation link so
the CLI `doctor`, the admin UI, and AI agents can surface consistent guidance.

## Package responsibilities

| Package                | Responsibility                                                                |
| ---------------------- | ----------------------------------------------------------------------------- |
| `fakebase`             | Main entry: `createClient`, kernel factories, re-exported types               |
| `@byronwade/client`     | `database-builder` + auth/storage/realtime/functions facades                  |
| `@byronwade/core`       | Kernel, schema IR, policy engine, query compiler, capability registry, errors |
| `@byronwade/adapter-*`  | Persistence implementations (memory/json/sqlite)                              |
| `@byronwade/auth`       | Local auth flows, session storage adapters, OTP inbox, PKCE helpers           |
| `@byronwade/storage`    | Bucket/object metadata, file IO, signed URLs/tokens                           |
| `@byronwade/realtime`   | Broadcast / presence / Postgres-change event bridge                           |
| `@byronwade/functions`  | Local function registry + `invoke`                                            |
| `@byronwade/migrations` | Schema diff, SQL export, seed export, snapshot/restore                        |
| `@byronwade/types`      | `database.types.ts` generation + helper types                                 |
| `@byronwade/cli`        | Command-line workflows                                                        |
| `@byronwade/ai`         | Rules, summaries, and prompt generation                                       |
| `@byronwade/test-utils` | Adapter contract suite + Supabase compatibility harness                       |

See [compatibility-matrix.md](compatibility-matrix.md) for method-level support and
[security.md](security.md) for the boundaries of the RLS/auth approximations.
