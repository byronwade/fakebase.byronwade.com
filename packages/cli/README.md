# `@fakebase/cli`

> Part of [**Fakebase**](https://github.com/byronwade/fakebase) — a Supabase-shaped, **local/dev-only** development platform for Next.js prototypes. Not for production use.

The `fakebase` command-line tool. Scaffold and run a local, Supabase-shaped backend for your Next.js prototype: `init`, `dev`, `studio`, `migrate`, `types`, `seed`, `verify`, `doctor`, and `ai`.

## Installation

```bash
pnpm add -D @fakebase/cli
```

Or run it without installing:

```bash
npx fakebase init
```

## Usage

```bash
# Scaffold Fakebase into the current project
npx fakebase init

# Common workflows
npx fakebase dev        # run the local dev backend
npx fakebase migrate    # apply schema changes
npx fakebase types      # generate database.types.ts
```

## What's inside

- Binary: `fakebase` (the command above).
- Programmatic API: `createProgram`, `loadConfig`, `writeDefaultConfig`, and type `FakebaseConfig`.

## Documentation

- [Project README](https://github.com/byronwade/fakebase#readme)
- [Architecture](https://github.com/byronwade/fakebase/blob/main/docs/architecture.md)
- [Compatibility matrix](https://github.com/byronwade/fakebase/blob/main/docs/compatibility-matrix.md)

## License

MIT
