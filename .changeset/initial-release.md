---
"fakebase": minor
"@fakebase/client": minor
"@fakebase/core": minor
"@fakebase/adapter-memory": minor
"@fakebase/adapter-json": minor
"@fakebase/adapter-sqlite": minor
"@fakebase/adapter-pglite": minor
"@fakebase/auth": minor
"@fakebase/storage": minor
"@fakebase/realtime": minor
"@fakebase/functions": minor
"@fakebase/migrations": minor
"@fakebase/types": minor
"@fakebase/cli": minor
"@fakebase/ai": minor
"@fakebase/test-utils": minor
---

Initial public release of Fakebase — a Supabase-shaped, local/dev-only development platform for
Next.js prototypes. Includes the compatibility kernel, memory/JSON/SQLite/PGlite (Postgres-in-WASM)
adapters, auth, storage, realtime, and functions engines, the Supabase-shaped client, migrations +
SQL/type export, the CLI, and AI rules/prompt generation. All adapters are verified against one
shared behavioural contract suite.
