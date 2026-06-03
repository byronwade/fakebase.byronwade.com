---
"@byronwade/server": minor
"@byronwade/cli": minor
---

Add `@byronwade/server` + `fakebase serve`: a local HTTP server that speaks the full Supabase
wire protocol — PostgREST `/rest/v1`, GoTrue `/auth/v1`, Storage `/storage/v1`, and Realtime
`/realtime/v1/websocket` (Phoenix channels) — backed by the kernel. The real
`@supabase/supabase-js` (browser or server) points at it as a true drop-in: database CRUD/filters,
auth, storage upload/download, and realtime `postgres_changes` all work with the stock client.
Fixes the server-only/in-process limitation that prevented client-side Supabase apps from using
Fakebase.
