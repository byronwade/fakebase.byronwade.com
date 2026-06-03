# Security

> [!CAUTION]
> **Fakebase is a development tool. It is not a security boundary and must never be used as
> production authentication or authorization.** A passing local policy check is _not_ proof that
> your production database is secure.

Fakebase optimizes for prototype velocity. To do that it approximates several Supabase/PostgreSQL
behaviors that are genuinely hard — and security-critical — to reproduce outside a real database.
This page is blunt about where those approximations end.

## Fakebase is not production auth

- Passwords are stored with a **development-only** hash, not a production-grade KDF.
- Tokens (`access_token` / `refresh_token`) are random local identifiers, not signed JWTs with
  verifiable claims.
- Sessions live in memory, a local JSON file, or cookies on your machine. There is no real
  identity provider, no email/SMS delivery, and no rotation/refresh hardening.
- OAuth, SSO, Web3, passkeys, MFA, and identity linking are **capability-gated** — they throw
  `CapabilityError` rather than pretending to authenticate.

Use Fakebase auth to build and test your _flows_. Validate real authentication against Supabase
Auth before shipping.

## Fakebase RLS is an approximation

Fakebase implements grants plus a policy engine with `anon` / `authenticated` / `service_role`
roles, `USING` / `WITH CHECK` evaluation, and default-deny when RLS is enabled with no matching
policy. But it evaluates policy expressions **as JavaScript**, not as PostgreSQL SQL.

It **cannot** guarantee:

- Exact SQL planner behavior or optimizer-sensitive policy evaluation.
- `SECURITY DEFINER` / `SECURITY INVOKER` semantics for arbitrary functions.
- `leakproof` behavior or visibility timing.
- Trigger ordering identical to PostgreSQL.
- Replication/RLS interactions or cross-schema privilege subtleties.
- Full custom SQL policy grammar.

Therefore: **a row that is hidden or rejected by Fakebase may behave differently in real
PostgreSQL, and vice versa.** Always run `fakebase verify supabase` and test RLS against a real
Supabase project before deployment.

## `service_role` and secret keys

- In Fakebase, `service_role` (or a secret/service key) **bypasses the policy engine entirely**,
  matching Supabase's documented behavior.
- The `service_role` key in real Supabase bypasses RLS and must **never** be exposed to the
  browser. Do not put it in client components, `NEXT_PUBLIC_*` env vars, or shipped bundles.
- Fakebase mirrors this risk locally: treat any secret-mode client as server-only.

## Functions and unauthenticated modes

Local functions run as plain JavaScript with no sandbox. An `auth: 'none'` / public function is
dangerous even locally if it is accidentally exposed beyond `localhost`. Keep the dev runtime and
admin UI bound to localhost.

## Admin UI constraints

The `@byronwade/admin` app is dev-only by design:

- Binds to `localhost` only.
- Intended to run in development; gate any non-dev exposure behind an explicit opt-in flag.
- Every screen is labeled local/dev-only.
- Never expose it on a public network.

## The hard rule

A local runtime helps you move faster. It must never tell you that you are "secure" because a mock
policy passed. Before any production handoff:

1. Export real Supabase SQL migrations (`fakebase migrate export --supabase`).
2. Recreate and **test** RLS policies in real PostgreSQL.
3. Run `fakebase verify supabase`.
4. Test auth and storage access against the real stack.

## Reporting a vulnerability

Fakebase is a local development tool and is not intended to process untrusted production data. If
you discover an issue that could affect users (for example, the dev server binding beyond
localhost, or the admin UI leaking secrets), please open a security advisory on the repository
rather than a public issue.
