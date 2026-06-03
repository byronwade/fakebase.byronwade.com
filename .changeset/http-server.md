---
"@byronwade/server": minor
"@byronwade/cli": minor
---

Add `@byronwade/server` + `fakebase serve`: a local HTTP server that speaks the Supabase wire
protocol (PostgREST `/rest/v1` + GoTrue `/auth/v1`) backed by the kernel. The real
`@supabase/supabase-js` — browser or server — points at it as a true drop-in. Fixes the
server-only/in-process limitation that prevented client-side Supabase apps from using Fakebase.
