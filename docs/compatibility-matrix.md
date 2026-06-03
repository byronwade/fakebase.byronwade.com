# Compatibility Matrix

This matrix labels each Supabase-shaped API by how faithfully Fakebase reproduces it. Statuses map
directly to the `CapabilityStatus` enum in `@fakebase/core`:

| Label           | Meaning                                                            |
| --------------- | ------------------------------------------------------------------ |
| **Exact**       | Behavior matches Supabase for documented cases.                    |
| **Close**       | Matches in practice; minor edge-case differences.                  |
| **Partial**     | Implemented with known, documented limitations.                    |
| **Unsupported** | Capability-gated — throws `CapabilityError`. Never silently faked. |

> Anything labeled **Partial** or **Unsupported** must be validated against real Supabase before
> production. Run `fakebase verify supabase` and `fakebase doctor`.

## Database — query builder (`from()`)

| Method                                     | Status      | Notes                                                                      |
| ------------------------------------------ | ----------- | -------------------------------------------------------------------------- |
| `select(columns)`                          | Exact       | Column projection; `*` supported.                                          |
| `insert(values)`                           | Exact       | Does **not** return rows unless chained with `.select()`.                  |
| `update(values)`                           | Exact       | Applies after filters; returns rows only with `.select()`.                 |
| `upsert(values)`                           | Close       | Conflict target inferred from primary key.                                 |
| `delete()`                                 | Exact       | Returns rows only with `.select()`.                                        |
| `eq` / `neq` / `gt` / `gte` / `lt` / `lte` | Exact       | Scalar comparisons.                                                        |
| `like` / `ilike`                           | Exact       | `%`/`_` wildcards; `ilike` is case-insensitive.                            |
| `is`                                       | Exact       | `null` / boolean checks.                                                   |
| `in`                                       | Exact       | Membership over an array.                                                  |
| `contains` / `containedBy` / `overlaps`    | Close       | Array/JSON containment evaluated in JS.                                    |
| `match(query)`                             | Exact       | Shorthand for multiple `eq`.                                               |
| `not(column, op, value)`                   | Close       | Negation of supported operators.                                           |
| `or(filters)`                              | Partial     | Accepts PostgREST-style filter strings; complex nested grammar is limited. |
| `filter(column, op, value)`                | Close       | Generic operator escape hatch.                                             |
| `order(column, options)`                   | Exact       | `ascending` + `nullsFirst`.                                                |
| `limit(count)`                             | Exact       |                                                                            |
| `range(from, to)`                          | Exact       | **0-based and inclusive**, matching Supabase.                              |
| `single()`                                 | Exact       | Errors unless exactly one row.                                             |
| `maybeSingle()`                            | Exact       | Errors if more than one row.                                               |
| `csv()`                                    | Close       | Serializes the result set to CSV.                                          |
| `abortSignal(signal)`                      | Close       | Cooperative cancellation.                                                  |
| `textSearch()`                             | Unsupported | Full-text search is not implemented.                                       |
| `explain()`                                | Unsupported | No query planner to introspect.                                            |
| `rpc(fn, args)`                            | Partial     | Calls a locally registered JS function; PL/pgSQL is not executed.          |

## Auth (`supabase.auth`)

| Method                                                         | Status      | Notes                                                              |
| -------------------------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| `signUp`                                                       | Close       | Optional email-confirmation toggle; password stored as a dev hash. |
| `signInWithPassword`                                           | Close       | Returns `{ data: { user, session }, error }`.                      |
| `signInWithOtp` / `verifyOtp`                                  | Partial     | OTP delivered to the local inbox, not real email/SMS.              |
| `getSession` / `getUser`                                       | Exact       |                                                                    |
| `setSession`                                                   | Close       |                                                                    |
| `exchangeCodeForSession`                                       | Partial     | Local PKCE-shaped code exchange.                                   |
| `signOut`                                                      | Exact       |                                                                    |
| `onAuthStateChange`                                            | Close       | In-process subscription.                                           |
| `admin.listUsers` / `createUser` / `updateUser` / `deleteUser` | Partial     | Local user store only.                                             |
| `signInWithOAuth` / SSO / Web3                                 | Unsupported | No external identity provider.                                     |
| `mfa.*` / passkeys / identity linking                          | Unsupported | Capability-gated.                                                  |

## Storage (`supabase.storage`)

| Method                                                                         | Status  | Notes                                                                    |
| ------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------ |
| `createBucket` / `getBucket` / `updateBucket` / `deleteBucket` / `listBuckets` | Close   | Metadata stored locally.                                                 |
| `from(bucket).upload` / `update`                                               | Close   | Bytes written under `.fakebase/storage/<bucket>/`.                       |
| `from(bucket).download`                                                        | Close   | Returns a `Blob`.                                                        |
| `from(bucket).list`                                                            | Close   | Folder rows have null metadata, like Supabase.                           |
| `from(bucket).remove`                                                          | Exact   |                                                                          |
| `from(bucket).move` / `copy`                                                   | Close   |                                                                          |
| `from(bucket).info`                                                            | Close   |                                                                          |
| `getPublicUrl`                                                                 | Close   | Builds a URL; does **not** validate bucket publicity (matches Supabase). |
| `createSignedUrl`                                                              | Partial | Deterministic local token; not a CDN-signed URL.                         |
| `createSignedUploadUrl`                                                        | Partial | Local token only.                                                        |

## Realtime (`supabase.channel`)

| Feature          | Status  | Notes                                                              |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Broadcast        | Close   | In-process pub/sub; optional local WebSocket bridge for multi-tab. |
| Postgres changes | Close   | Emitted from the mutation commit pipeline.                         |
| Presence         | Partial | TTL heartbeats; best-effort, not for high-frequency updates.       |

## Functions (`supabase.functions`)

| Feature                            | Status      | Notes                                 |
| ---------------------------------- | ----------- | ------------------------------------- |
| `invoke(name, options)`            | Partial     | Runs a locally registered JS handler. |
| Deno edge runtime / global routing | Unsupported | Use Next.js Route Handlers locally.   |

## Migrations, types, and roles

| Feature                                                              | Status      | Notes                                       |
| -------------------------------------------------------------------- | ----------- | ------------------------------------------- |
| Schema diff → SQL                                                    | Close       | `fakebase migrate diff` / `export`.         |
| `supabase/seed.sql` export                                           | Close       | `fakebase seed export`.                     |
| Schema-driven fake data                                              | Close       | `fakebase seed gen` / `seedClient` — FK-correct, deterministic. See [seeding](./seeding.md). |
| `database.types.ts` generation                                       | Close       | Row / Insert / Update + `Tables<>` helpers. |
| Roles `anon` / `authenticated` / `service_role`                      | Partial     | `service_role` bypasses the policy engine.  |
| RLS `USING` / `WITH CHECK` / default-deny                            | Partial     | JavaScript predicate approximation.         |
| Permissive vs restrictive composition                                | Partial     | Approximated.                               |
| `SECURITY DEFINER`, planner-sensitive policies, triggers, extensions | Unsupported | Not reproduced.                             |

## Platform features (stub / export-only)

| Feature                             | Status      | Notes                                                                                                      |
| ----------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| Backups / PITR                      | Stub        | Use `fakebase snapshot save/restore` for local snapshots.                                                  |
| Vector / `pgvector`                 | Unsupported | Not exposed by the adapters yet; `@fakebase/adapter-pglite` (Postgres-in-WASM) is the natural home for it. |
| `pg_cron` / `pg_net` / `pg_graphql` | Unsupported | Capability-gated.                                                                                          |
