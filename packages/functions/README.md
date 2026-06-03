# `@fakebase/functions`

> Part of [**Fakebase**](https://github.com/byronwade/fakebase) — a Supabase-shaped, **local/dev-only** development platform for Next.js prototypes. Not for production use.

A local function registry with Supabase-shaped invoke and RPC. Register handlers in-process and call them via `invoke()` / `invokeRpc()`, mirroring `supabase.functions`.

## Installation

```bash
pnpm add @fakebase/functions
```

Install this package directly to use the registry standalone.

## Usage

```ts
import { FunctionRegistry } from "@fakebase/functions";

const functions = new FunctionRegistry();
functions.register({
  name: "hello",
  handler: (req) => ({ body: { message: "Hello!" } }),
});

const { data, error } = await functions.invoke("hello", { body: { name: "world" } });
```

## What's inside

- `FunctionRegistry` — `register`, `invoke` (returns `{ data, error }`), `invokeRpc`, `list`, `get`.
- `LocalEnv` — a small local env-var helper (+ type `LocalEnvConfig`).
- Types: `FunctionDefinition`, `FunctionRequest`, `FunctionResponse`, `FunctionInvokeOptions`, `FunctionAuth`.

Dev-only — handlers run in your local Node process, not an isolated edge runtime.

## Documentation

- [Project README](https://github.com/byronwade/fakebase#readme)
- [Architecture](https://github.com/byronwade/fakebase/blob/main/docs/architecture.md)
- [Compatibility matrix](https://github.com/byronwade/fakebase/blob/main/docs/compatibility-matrix.md)

## License

MIT
