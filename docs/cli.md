# CLI Reference

The `fakebase` CLI is intentionally narrow and opinionated. Run any command with `--help` for
inline usage.

```bash
npx @byronwade/cli <command> [subcommand] [options]
```

## `fakebase init`

Initialize Fakebase in the current project. Creates the `fakebase/` directory structure
(schema, seeds, storage) and a `lib/fakebase.ts` helper for Next.js apps.

```bash
fakebase init
```

## `fakebase dev`

Start the Fakebase local development server.

| Option          | Description                                |
| --------------- | ------------------------------------------ |
| `--studio`      | Also start the admin UI server             |
| `--port <port>` | Port for the dev server (default: `54321`) |

```bash
fakebase dev --studio --port 54321
```

## `fakebase studio`

Open the dev-only admin UI in the browser. See [admin-ui.md](admin-ui.md).

```bash
fakebase studio
```

## `fakebase migrate`

Manage database migrations.

| Subcommand            | Description                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `new <name>`          | Diff from the last migration and write SQL to `fakebase/migrations/<timestamp>_<name>.sql` |
| `diff`                | Print the SQL diff between the current schema and the last applied migration               |
| `export [--supabase]` | Export pending migrations; `--supabase` writes to `supabase/migrations/`                   |
| `apply`               | Apply pending migrations to the local adapter                                              |
| `status`              | Show migrations and their applied status                                                   |

```bash
fakebase migrate new add_profiles
fakebase migrate diff
fakebase migrate export --supabase
fakebase migrate status
```

## `fakebase types gen`

Generate `database.types.ts` from `fakebase/schema.ts`. The output matches Supabase's generator
shape (`Database` with `Tables`/`Views`/`Functions`/`Enums`/`CompositeTypes`, per-table
`Row`/`Insert`/`Update`, and `Tables<>` helpers).

```bash
fakebase types gen
```

## `fakebase seed`

| Subcommand | Description                                                     |
| ---------- | --------------------------------------------------------------- |
| `run`      | Load and run `fakebase/seeds/seed.ts` against the local adapter |
| `export`   | Export current seed data to `supabase/seed.sql`                 |
| `gen`      | Generate referentially-correct fake data from your schema       |

```bash
fakebase seed run
fakebase seed export

# Generate deterministic fake data straight from the schema -> supabase/seed.sql
fakebase seed gen --rows 20
fakebase seed gen --table posts:100 --table comments:300 --seed 42
fakebase seed gen --report          # show how each column resolves
fakebase seed gen --faker           # use @faker-js/faker for richer data
```

`seed gen` fills every column intelligently (emails, names, FK references, enums) with no
hand-written seed file. See **[Fake Data Generation](./seeding.md)** for the full guide:
semantic mappings, overrides, determinism, and the pluggable Faker provider.

## `fakebase auth`

Inspect the local auth service.

| Subcommand | Description                                       |
| ---------- | ------------------------------------------------- |
| `inbox`    | Print the local OTP / magic-link inbox as a table |
| `users`    | List all local auth users                         |

```bash
fakebase auth inbox
fakebase auth users
```

## `fakebase snapshot`

Save and restore named snapshots of the local adapter state — the local equivalent of
backups/PITR.

| Subcommand        | Description                                                            |
| ----------------- | ---------------------------------------------------------------------- |
| `save [label]`    | Save current state as a named snapshot (defaults to a timestamp label) |
| `restore <label>` | Restore a previously saved snapshot                                    |
| `list`            | List all saved snapshots                                               |

```bash
fakebase snapshot save before-refactor
fakebase snapshot list
fakebase snapshot restore before-refactor
```

## `fakebase verify supabase`

Run compatibility scenarios against **both** Fakebase and a real Supabase stack, then print a
match matrix. Requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the environment. This is the
recommended gate before any production handoff.

```bash
SUPABASE_URL=http://localhost:54321 SUPABASE_ANON_KEY=... fakebase verify supabase
```

## `fakebase doctor`

Run a health check on the setup: schema, generated types, migrations, adapter, and app code. It
also reports any unsupported APIs in use, so capability gaps surface early.

```bash
fakebase doctor
```

## `fakebase ai`

Generate AI agent rule files and prompts. See [ai-rules.md](ai-rules.md).

| Subcommand                                | Description                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `init`                                    | Generate `.cursor/rules/fakebase.mdc`, `AGENTS.md`, `fakebase.rules.md`, and `docs/` summaries |
| `prompt [--target <t>] [--output <file>]` | Generate a task-specific agent prompt                                                          |

`--target` accepts `cursor`, `claude`, `copilot`, or `generic` (default). `--output` writes to a
file instead of stdout.

```bash
fakebase ai init
fakebase ai prompt --target cursor --output prompt.md
```
