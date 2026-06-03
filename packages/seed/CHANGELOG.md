# @fakebase/seed

## 0.2.0

### Minor Changes

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
  - @fakebase/core@0.2.0
