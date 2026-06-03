# `@fakebase/migrations`

> Part of [**Fakebase**](https://github.com/byronwade/fakebase) — a Supabase-shaped, **local/dev-only** development platform for Next.js prototypes. Not for production use.

Schema tooling for Fakebase: define a schema with the `schema()` DSL, diff two schemas, manage migrations and snapshots, and export Supabase-compatible SQL/seed scripts when you're ready to graduate to real Supabase.

## Installation

```bash
pnpm add -D @fakebase/migrations
```

## Usage

```ts
import { schema, exportSupabaseSql } from "@fakebase/migrations";

const ir = schema({
  tables: {
    todos: {
      columns: {
        id: { type: "uuid", primaryKey: true, default: "gen_random_uuid()" },
        title: { type: "text" },
        done: { type: "bool", default: "false" },
      },
    },
  },
});

const sql = exportSupabaseSql(ir);
```

## What's inside

- DSL + parsers: `schema`, `parseTypescriptSchema`, `parseSqlSchema`.
- Diffing: `diffSchemas`, `diffToSql`, `isSchemaDiffEmpty`.
- Export: `exportSupabaseSql`, `exportSeedSql` (+ `ExportSqlOptions`).
- Management: `MigrationManager`, `SnapshotManager`.

## Documentation

- [Project README](https://github.com/byronwade/fakebase#readme)
- [Architecture](https://github.com/byronwade/fakebase/blob/main/docs/architecture.md)
- [Compatibility matrix](https://github.com/byronwade/fakebase/blob/main/docs/compatibility-matrix.md)

## License

MIT
