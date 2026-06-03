# `@byronwade/types`

> Part of [**Fakebase**](https://github.com/byronwade/fakebase) — a Supabase-shaped, **local/dev-only** development platform for Next.js prototypes. Not for production use.

Generates a Supabase-shaped `database.types.ts` from a Fakebase schema IR, so `createClient<Database>()` gets full type inference — just like `supabase gen types typescript`.

## Installation

```bash
pnpm add -D @byronwade/types
```

## Usage

```ts
import { generateTypes } from "@byronwade/types";
import { writeFileSync } from "node:fs";

// `schema` is a ProjectSchemaIR (e.g. from `@byronwade/migrations`' `schema()`).
const dts = generateTypes(schema, { enumsAsUnions: true });
writeFileSync("database.types.ts", dts);
```

## What's inside

- `generateTypes(schema, options?)` — returns the `database.types.ts` source as a string.
- Type `GenerateTypesOptions` — e.g. `enumsAsUnions` to emit union types instead of `enum` declarations.

Usually invoked for you via `fakebase types` in the CLI.

## Documentation

- [Project README](https://github.com/byronwade/fakebase#readme)
- [Architecture](https://github.com/byronwade/fakebase/blob/main/docs/architecture.md)
- [Compatibility matrix](https://github.com/byronwade/fakebase/blob/main/docs/compatibility-matrix.md)

## License

MIT
