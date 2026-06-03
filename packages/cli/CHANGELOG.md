# @fakebase/cli

## 0.2.0

### Minor Changes

- 758e902: Initial public release of Fakebase — a Supabase-shaped, local/dev-only development platform for
  Next.js prototypes. Includes the compatibility kernel, memory/JSON/SQLite/PGlite (Postgres-in-WASM)
  adapters, auth, storage, realtime, and functions engines, the Supabase-shaped client, migrations +
  SQL/type export, the CLI, and AI rules/prompt generation. All adapters are verified against one
  shared behavioural contract suite.
- 758e902: Add schema-driven fake data generation.
  - New `@fakebase/seed` package: generate realistic, referentially-correct, deterministic
    rows straight from your schema. `seedClient()` for runtime auto-seed, `generateRows()`
    for the pure engine, `describeResolution()` for an honest per-column report. Zero-dependency
    built-in data provider with a pluggable `DataProvider` interface.
  - New optional `@fakebase/seed-faker` package: a `@faker-js/faker`-backed provider for richer
    data and locales.
  - New `fakebase seed gen` CLI command (`--rows`, `--table name:count`, `--seed`, `--out`,
    `--report`, `--faker`) writing a byte-stable `supabase/seed.sql`.
  - `@fakebase/migrations`: `parseSqlSchema` now parses `CREATE TYPE … AS ENUM`; `exportSeedSql`
    accepts `{ timestamp: false }` for byte-identical output.

### Patch Changes

- Updated dependencies [758e902]
- Updated dependencies [758e902]
  - @fakebase/client@0.2.0
  - @fakebase/core@0.2.0
  - @fakebase/adapter-memory@0.2.0
  - @fakebase/adapter-json@0.2.0
  - @fakebase/adapter-sqlite@0.2.0
  - @fakebase/adapter-pglite@0.2.0
  - @fakebase/auth@0.2.0
  - @fakebase/migrations@0.2.0
  - @fakebase/types@0.2.0
  - @fakebase/test-utils@0.2.0
  - @fakebase/seed@0.2.0
  - @fakebase/seed-faker@0.2.0
