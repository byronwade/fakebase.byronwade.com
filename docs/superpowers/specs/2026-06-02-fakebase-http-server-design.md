# Fakebase Local HTTP Server (`@byronwade/server`) — Phase 1: DB + Auth — Design

**Date:** 2026-06-02
**Status:** Approved-pending-review
**Author:** Byron Wade (with Claude)
**Builds on:** the existing kernel (`packages/core` — `FakebaseKernel.query(plan)`, `setRole`),
`@byronwade/auth`, and the CLI (`fakebase dev`/`serve`).

## The flaw this fixes

Fakebase is **not** a drop-in for `@supabase/supabase-js`. `createClient(url, key, { kernel })`
ignores `url`/`key` and talks to the `kernel` **in-process**; the kernel imports `node:fs`/
`node:crypto`/`node:os`/`node:path`, so it is **server-only**. `fakebase dev` does not serve HTTP.
Real supabase-js is isomorphic (browser + server) and talks HTTP to PostgREST/GoTrue/Storage, so
the dominant Supabase pattern — client components fetching directly, browser auth, realtime — can
**not** use Fakebase without re-routing the whole app through Server Actions/Route Handlers. This
is the wall real apps (e.g. `ciel.byronwade.com`) hit.

**Fix (chosen):** make Fakebase serve a **local HTTP server** that speaks Supabase's wire protocol,
backed by the existing kernel — exactly what `supabase start` is. Then the **real**
`@supabase/supabase-js`, browser or server, points at `http://localhost:54321` and works with zero
app changes. The in-process client stays as a fast server-only option.

This spec covers **Phase 1: DB (`/rest/v1`) + Auth (`/auth/v1`)**. Storage and Realtime are
Phases 2–3 (separate specs).

## Why this is tractable

The kernel already exposes the right seam, so the HTTP layer is a thin protocol skin:

- **`kernel.query(plan: QueryPlan): Promise<KernelQueryResult>`** handles every DB op
  (select/insert/update/delete) and `rpc`. The `QueryPlan` operator set is already PostgREST-aligned
  (`eq`/`neq`/`gt`/`like`/`ilike`/`is`/`in`/`contains`/`fts`/…, plus `OrFilter`/`AndFilter`). The
  REST layer is mainly a **PostgREST-URL → QueryPlan parser**.
- **Auth** (`@byronwade/auth`) already produces GoTrue-shaped sessions
  (`access_token`/`refresh_token`/`token_type`/`expires_in`/`expires_at`) and a user store. Phase 1
  adds JWT signing + the `/auth/v1/*` endpoint shapes around it.
- **`kernel.setRole(ctx)`** already drives the policy engine, so per-request RLS is a matter of
  mapping the bearer token → role context before `kernel.query()`.

## Architecture

New package **`packages/server` → `@byronwade/server`**. Dependencies: `@byronwade/core`,
`@byronwade/auth`. No HTTP framework — built on the Web `Request`/`Response` API so the same handler
runs under `node:http`, Bun, Deno, or an edge runtime.

```
packages/server/src/
  server.ts        # createFakebaseServer() — wires router + handlers; .fetch + .listen
  router.ts        # tiny method+path matcher
  rest/
    parse.ts       # PostgREST query/string/headers/body → QueryPlan   (pure, unit-tested)
    handler.ts     # /rest/v1/:table + /rest/v1/rpc/:fn → kernel.query() → Response
    response.ts    # PostgREST response shaping (Content-Range, single-object, errors)
  auth/
    handler.ts     # /auth/v1/* → auth engine
    jwt.ts         # HS256 sign/verify via node:crypto (no deps)
  context.ts       # request → role context (anon | authenticated | service_role)
  cors.ts          # preflight + headers
  errors.ts        # kernel/Capability errors → PostgREST error JSON + status
  node.ts          # node:http adapter (listen)
  index.ts
```

### Public API

```ts
export function createFakebaseServer(opts: {
  kernel: FakebaseKernel;
  jwtSecret?: string;      // default: a fixed dev secret
  anonKey?: string;        // default: a fixed dev anon key
  serviceKey?: string;     // default: a fixed dev service key
  cors?: boolean | { origins: string[] };  // default true (*) for dev
}): {
  fetch(req: Request): Promise<Response>;
  listen(port?: number): Promise<{ url: string; close(): Promise<void> }>;
};
```

`fetch(Request) → Response` is the core and is independently testable. `listen()` is a thin
`node:http` wrapper used by the CLI.

## Data flow — `/rest/v1/:table`

1. **Auth/role:** read `Authorization: Bearer <jwt>` and/or `apikey` → verify → derive role
   (`service_role` for the service key, `authenticated` for a valid user JWT, else `anon`) →
   `kernel.setRole({ role, claims })`.
2. **Method → operation:** `GET`=select, `POST`=insert, `PATCH`=update, `DELETE`=delete.
3. **Parse → QueryPlan** (`rest/parse.ts`, pure):
   - Filters: `?<col>=<op>.<value>` → `SimpleFilter` (e.g. `published=eq.true`, `id=in.(1,2,3)`,
     `name=ilike.*foo*`, `age=not.is.null` → `negate`). Operator names map ~1:1 to
     `PlanFilterOperator`.
   - `or=(a.eq.1,b.eq.2)` → `OrFilter`; `and=(...)` → conjunction.
   - `select=col1,col2` → projection (`*` supported). **Embedded resources** (`author(*)`) are a
     documented non-goal for Phase 1.
   - `order=col.desc.nullsfirst` → order spec.
   - `limit`/`offset` and the `Range` header → range (0-based inclusive, matching Supabase).
   - Body (POST/PATCH JSON) → insert/update values (array or object).
   - `Prefer`: `return=representation` (return rows) vs `minimal` (204/no body);
     `count=exact` (compute + `Content-Range`); `resolution=merge-duplicates` (upsert).
4. **Execute:** `await kernel.query(plan)`.
5. **Shape response** (`rest/response.ts`): JSON array, or a single object when
   `Accept: application/vnd.pgrst.object+json`; set `Content-Range` for ranges/counts; map errors to
   PostgREST `{ message, code, details, hint }` + status (e.g. `single()` mismatch → 406,
   `CapabilityError` → 501).

`/rest/v1/rpc/:fn` — POST body = args → functions engine → JSON result.

## Data flow — `/auth/v1/*` (GoTrue subset)

| Endpoint                              | Maps to                          |
| ------------------------------------- | -------------------------------- |
| `POST /signup`                        | `auth.signUp` → user + session   |
| `POST /token?grant_type=password`     | `auth.signInWithPassword`        |
| `POST /token?grant_type=refresh_token`| refresh the session              |
| `GET /user` (Bearer)                  | current user from the token      |
| `POST /logout`                        | `auth.signOut`                   |

Tokens: the auth engine's opaque `access_token` is replaced/wrapped by an **HS256 JWT**
(`auth/jwt.ts`, `node:crypto` HMAC — no dependency) with claims `{ sub, role: "authenticated",
email, exp, iat }`, so supabase-js can decode expiry/user locally. The server verifies incoming
bearer JWTs the same way. OTP/magic-link and admin endpoints are deferred (return a documented
`CapabilityError`-style 501 in Phase 1).

## CORS

Preflight `OPTIONS` → 204 with `Access-Control-Allow-Origin` (configured origins; `*` in dev),
`-Allow-Methods`, `-Allow-Headers` (`authorization, apikey, content-type, prefer, range`), and
`Access-Control-Expose-Headers: Content-Range`. Applied to every response.

## CLI

- **`fakebase serve [--port 54321] [--studio]`**: `buildKernel(...)` (existing) →
  `createFakebaseServer({ kernel }).listen(port)` → prints:
  ```
  Fakebase API   http://localhost:54321
  anon key       <dev-anon-key>

    import { createClient } from "@supabase/supabase-js";
    const supabase = createClient("http://localhost:54321", "<anon key>");
  ```
- **`fakebase dev`** also starts the server (dev = serving), keeping the file-watcher.

## Error handling

`errors.ts` centralizes mapping: filter/parse errors → 400; `single()`/`maybeSingle()` violations →
406; not-found table → 404; unsupported feature (`CapabilityError`) → 501 with the structured
message (preserves Fakebase's "honest capabilities" ethos); unexpected → 500. All bodies use the
PostgREST error shape so supabase-js surfaces them in `error`.

## Testing

- **Unit (`rest/parse.ts`):** PostgREST params → `QueryPlan` for filters (every operator), `or`,
  `in`, `not`, `select`, `order`, `limit`/`offset`/`Range`, and `Prefer` (representation / count /
  merge-duplicates). Pure functions, exhaustive.
- **Unit (`auth/jwt.ts`):** sign → verify round-trip; tamper/expiry rejection.
- **Integration:** construct `createFakebaseServer({ kernel })` over a memory kernel and drive
  `server.fetch(new Request(...))` for CRUD, filters, Prefer, `Content-Range`, RLS-by-role, and
  error shapes.
- **End-to-end with the REAL `@supabase/supabase-js`** (devDependency): create it with a custom
  `global.fetch` that routes to the in-process handler, then exercise
  `from().select().eq().order().range().single()`, `insert/update/delete/upsert`,
  `rpc()`, and `auth.signUp/signInWithPassword/getUser/signOut`. Asserting the real client works is
  the **definitive proof** the drop-in claim holds.

## Non-goals (Phase 1)

- Storage (`/storage/v1`) and Realtime (`/realtime/v1` websocket) — Phases 2 and 3.
- Embedded-resource joins (`select=*,author(*)`) — basic projection only; documented limitation.
- Schemas other than `public` (the client's `schema()` switch) — follow-on.
- Full GoTrue surface (OTP, OAuth, admin) — deferred behind honest 501s.

## Open questions for review

1. Package name `@byronwade/server` — good, or `@byronwade/serve` / fold into `@byronwade/cli`?
2. Default dev `anonKey`/`serviceKey`/`jwtSecret` values — fixed well-known constants (like
   `supabase start`'s static keys) so examples/copy-paste are stable. OK?
3. Should `fakebase dev` *replace* its current behavior with `serve`, or keep `dev`
   (watch-only) and add `serve` (HTTP) as a separate command? (Spec assumes `dev` starts the
   server.)
