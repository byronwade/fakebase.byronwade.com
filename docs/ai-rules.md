# AI Rules & Prompts

Fakebase is built to be driven by AI coding agents. The `@fakebase/ai` package and the
`fakebase ai` CLI generate machine-readable rules, schema summaries, and task prompts so that
agents understand the project's schema _and_ the hard constraints of a local/dev-only backend.

## Generate the files

```bash
fakebase ai init
```

This scaffolds:

| File                         | Purpose                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `fakebase.rules.md`          | Primary rules file: project overview, schema tables, critical warnings, migration workflow, and the list of unsupported capabilities |
| `schema.summary.md`          | Human-readable description of tables, columns, relationships, enums, and functions                                                   |
| `policies.summary.md`        | RLS policies, the role access matrix, and limitations vs real Postgres RLS                                                           |
| `compatibility.summary.md`   | Capability table (`SUPPORTED` / `PARTIAL` / `STUB` / `UNSUPPORTED`)                                                                  |
| `migration.checklist.md`     | Checklist to complete before switching to real Supabase                                                                              |
| `.cursor/rules/fakebase.mdc` | Cursor-native rules                                                                                                                  |
| `AGENTS.md`                  | Generic agent guidance                                                                                                               |

All generated docs are regenerated from the current schema IR — never hand-edit them; re-run
`fakebase ai init` instead.

## Task prompts

```bash
fakebase ai prompt --target cursor          # cursor | claude | copilot | generic
fakebase ai prompt --target generic --output prompt.md
```

`ai prompt` emits a prompt tailored to the target tool, pre-loaded with the schema summary and the
Fakebase guardrails so an agent starts with correct context.

## Guardrails baked into the rules

The generated rules encode hard constraints so agents don't drift into unsafe assumptions:

- **Local/dev-only.** Fakebase is never production auth or RLS; sessions, tokens, and users are
  ephemeral.
- **RLS is approximate.** Policies are evaluated in JavaScript, not SQL. Always verify against
  real Supabase before deploying.
- **Never invent unsupported APIs.** If a capability returns `CapabilityError.notImplemented()`,
  surface the error and suggest a compatible alternative — don't work around it.
- **Always export SQL** (`fakebase migrate export`) before claiming a backend feature is complete.
- **Always run `fakebase verify supabase`** before production handoff.
- **Use cookie storage + PKCE-shaped flows** for Next.js SSR.

## Why this exists

Supabase itself ships AI prompts, agent skills, and MCP tooling because workflow guidance
measurably improves agent output. Fakebase follows the same lesson in a smaller, sharper form: the
generated context keeps agents productive while preventing them from treating local approximations
as production guarantees.
