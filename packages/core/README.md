# `@byronwade/core`

> Part of [**Fakebase**](https://github.com/byronwade/fakebase) — a Supabase-shaped, **local/dev-only** development platform for Next.js prototypes. Not for production use.

The low-level kernel that powers Fakebase: schema IR, query compiler, RLS policy engine, capability registry, event bus, and the canonical error model. Adapters and the client are built on top of it — you rarely import this directly.

## Installation

```bash
pnpm add fakebase
```

This package ships with `fakebase` and is published as `@byronwade/core`.

## Usage

```ts
import { FakebaseKernel } from "@byronwade/core";
import { MemoryAdapter } from "@byronwade/adapter-memory";

// Adapters supply a concrete FakebaseAdapter; core wires it into a kernel.
const kernel = new FakebaseKernel({ adapter: new MemoryAdapter() });
await kernel.initialize();
```

## What's inside

- `FakebaseKernel`, `SchemaRegistry`, `PolicyEngine`, `EventBus`, `CapabilityRegistry`, `FakeStore`.
- Query engine: `compileQuery`, `applyFilter`, `parseOrString`.
- Error model: `FakebaseError`, `FakebaseErrorCode`, `CapabilityError`, `toSupabaseError`.
- Engine contracts + value types: `AuthEngine`, `StorageEngine`, `RealtimeEngine`, `FunctionsEngine`, schema IR types (`ProjectSchemaIR`, `TableIR`, `ColumnIR`, …).

## Documentation

- [Project README](https://github.com/byronwade/fakebase#readme)
- [Architecture](https://github.com/byronwade/fakebase/blob/main/docs/architecture.md)
- [Compatibility matrix](https://github.com/byronwade/fakebase/blob/main/docs/compatibility-matrix.md)

## License

MIT
