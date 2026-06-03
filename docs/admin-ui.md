# Admin UI

`@fakebase/admin` (in `apps/admin`) is an optional, **dev-only** Next.js app for inspecting and
editing your local Fakebase state — a focused "developer cockpit," not a full Supabase Studio
clone.

```bash
fakebase studio        # or: pnpm --filter @fakebase/admin dev
```

> [!WARNING]
> The admin UI is for local development only. It binds to `localhost`, is labeled dev-only on
> every screen, and must never be exposed on a public network. See [security.md](security.md).

## Tabs

| Tab            | Route         | What it does                                                                      |
| -------------- | ------------- | --------------------------------------------------------------------------------- |
| **Data**       | `/data`       | Browse and edit rows, inspect relations, import/export JSON & CSV                 |
| **Auth**       | `/auth`       | View users and sessions, read the OTP / magic-link inbox, impersonate a role/user |
| **Storage**    | `/storage`    | Browse buckets, upload/download files, inspect object metadata                    |
| **Realtime**   | `/realtime`   | Inspect channels, watch the Postgres-change stream, view presence                 |
| **Policies**   | `/policies`   | Preview effective access by role and user (RLS preview)                           |
| **Migrations** | `/migrations` | View the local diff, preview generated SQL, check export status                   |
| **Types**      | `/types`      | Preview `database.types.ts`, copy/download                                        |
| **Functions**  | `/functions`  | Invoke local RPC / functions and inspect logs                                     |
| **AI**         | `/ai`         | View generated rules files, prompts, and guardrail status                         |

## Design constraints

- **Localhost only.** The app is not meant to be deployed; gate any non-dev exposure behind an
  explicit opt-in.
- **Dev-only labeling.** Every screen is visibly marked local/dev-only so it is never mistaken for
  a production console.
- **No secret exposure.** Service-role-style functionality stays on the machine.
- **Read-with-care writes.** Editing rows, uploading files, and impersonating users all mutate the
  same local adapter your app uses, so changes are immediately visible to the running app.

## Capability awareness

Where a feature is `PARTIAL` or `UNSUPPORTED` (see [compatibility-matrix.md](compatibility-matrix.md)),
the relevant screen surfaces a capability warning rather than implying full parity. For example,
the Policies tab notes that RLS previews are a JavaScript approximation, and the Functions tab
notes that handlers are local JS rather than a Deno edge runtime.

## Testing

The admin UI ships with Playwright smoke tests (`pnpm test:e2e`) that exercise the core views —
for example, editing a row in the Data tab and verifying the change persists in the adapter.
