# Live Playground Merge + Deeper "How It Works" — Design

**Date:** 2026-06-01
**Status:** Approved-pending-review
**Author:** Byron Wade (with Claude)
**Builds on:** [2026-06-01-fakebase-marketing-docs-site-design.md](./2026-06-01-fakebase-marketing-docs-site-design.md)

## Goal

Two connected asks: (1) merge `apps/playground-nextjs` into the marketing/docs site
(`apps/web`) as a **live, interactive demo**, and (2) make "how it works" genuinely
understandable. The live demo is the centerpiece of the answer to #2 — people understand
Fakebase fastest by watching real `{ data, error }` results come back from the same call shape
they'd write against Supabase.

## Decisions (locked with user)

- **Live interactive demo** at `apps/web/app/playground` — the real fakebase kernel runs
  server-side. Visitors create / toggle / delete / query real data and sign up / in / out.
- **Per-visitor sandbox**: each visitor gets their own isolated in-memory kernel, keyed by a
  cookie. Edits and auth state are theirs alone; a "Reset demo data" action re-seeds.
- **Live scope: DB CRUD + auth.** Both are exercised live. Storage is shown as code in the
  walkthrough (not a live write target on the marketing site).
- **`apps/playground-nextjs` is deleted** after the merge; `/examples` points at the in-site
  `/playground` plus the GitHub `examples/`.
- **Four understanding additions:** the live playground, an "anatomy of a query" walkthrough
  (folded into a richer `/how-it-works`), a Getting Started tutorial, and richer how-it-works
  diagrams + before/after code.

## Key technical facts (verified)

- `createMemoryKernel(schema)` (from `@fakebase/adapter-memory`) constructs a **fresh**
  `MemoryAdapter` + **fresh** `LocalAuthService` (its own `MemorySessionStorage` + user/OTP
  maps) + **fresh** `LocalStorageService` (unique `tmpdir`) on every call. Therefore a
  per-visitor kernel automatically has **per-visitor auth sessions and data** — no global auth
  store, no desync. (Resolves the auth-scoping risk by construction.)
- The memory adapter is pure in-memory (no fs), so it runs in any server runtime.
- A `QueryPlan` type exists (`packages/core/src/query/plan.ts`) but there is no confirmed public
  "explain this builder chain without executing" API. The anatomy walkthrough therefore keeps
  **intermediate stages illustrative** (hand-authored shapes matching the real `QueryPlan` /
  policy-predicate types) and only the **endpoints live** (the call you write + the real
  `{ data, error }` it returns).

## Deployment posture (designed to degrade)

The per-visitor registry is a server-memory `Map<sessionId, kernel>`. This is solid on a single
long-running Node process (container / Railway / Fly) and **best-effort-but-graceful** on
serverless (cold starts / multiple instances may not share memory). To make the deployment
target a non-issue:

- The registry **lazily re-seeds**: `getKernel(id) = registry.get(id) ?? createAndSeed(id)`. A
  missing kernel yields a fresh seeded sandbox — never an error. Worst case on a cold instance
  is "your sandbox looks freshly seeded," which is acceptable for a demo.
- The `Map` is stored on a `globalThis` singleton so it survives dev HMR.
- A simple **LRU/TTL cap** (e.g. max 500 kernels, evict oldest / 30-min idle) bounds memory.

The deployment target is not yet pinned; because the design degrades gracefully, it does not
need to be to ship. (Single-server hosting makes the sandbox rock-solid; note this when
deploying.)

## Architecture

### Per-visitor kernel registry (`apps/web/lib/playground/registry.ts`, server-only)

```
globalThis.__fbPlaygroundRegistry ??= new Map<string, { kernel, lastSeen }>()

getOrCreateKernel(sessionId):
  entry = registry.get(sessionId)
  if (!entry) { kernel = createMemoryKernel(schema); seed(kernel); entry = {kernel, lastSeen:now} ; registry.set(...) }
  entry.lastSeen = now
  evictStale()        // LRU/TTL cap
  return entry.kernel
```

- `sessionId`: an httpOnly cookie (`fb_pg`) set on first playground request via a Server Action
  / route handler. UUID value.
- `getClientForRequest()`: reads the cookie (creating one if absent), returns a
  `createClient(..., { kernel })` bound to that visitor's kernel. **Replaces the module-singleton
  `supabase`** the old playground used.
- `schema` + `seed()`: ported from `apps/playground-nextjs/lib/fakebase.ts` (users / posts /
  comments IR + seed rows) into `apps/web/lib/playground/schema.ts`.

### Playground UI (`apps/web/app/playground/`)

- `page.tsx` — overview + the live notes/posts CRUD (Server Component reads via
  `getClientForRequest()`; mutations via Server Actions). Each panel renders the **code** that
  ran beside the **actual returned `{ data, error }`** (a reusable `<CallResult code result />`).
- Auth panel — sign up / in / out via Server Actions; shows the live session state.
- "Reset demo data" Server Action — drops the visitor's kernel entry so the next read re-seeds.
- Storage — a read-only code+explanation panel (not a live write target here).
- Styled entirely with byronwade/ui (cards, badges, tabs, buttons, code surface).

### `next.config.ts`

- De-risk: confirm whether Turbopack/Next 16 needs `transpilePackages: ["fakebase",
"@fakebase/adapter-memory", "@fakebase/core", ...]`. Add it if the import-and-run proof fails
  without it. (The old playground proved these packages under Webpack/Next 15, not
  Turbopack/16.)

### `apps/web/package.json`

- Add `fakebase: workspace:*`, `@fakebase/adapter-memory: workspace:*` (and any transitive
  workspace deps the kernel needs at runtime). `@fakebase/web` is added to the changeset ignore
  list already.

## Content surfaces

### Richer `/how-it-works` (+ anatomy of a query)

- Add a **before/after "Supabase vs Fakebase"** block showing the call shape is identical.
- Add **"Anatomy of a query"**: an annotated trace of one real call —
  `from("posts").select().eq("published", true)` → facade → kernel → query compiler
  (illustrative `QueryPlan`) → policy engine (illustrative predicate) → adapter → **live**
  `{ data, error }`. Endpoints live; middle stages illustrative.
- Clearer diagrams of the existing stack/fidelity sections.

### Getting Started tutorial (`docs/getting-started.md`)

- New markdown in **root `docs/`** (single source of truth) — auto-renders in the docs sidebar
  via the existing `react-markdown` pipeline; add it to the `ORDER` list in `lib/docs.ts` near
  the top.
- Steps: install → `lib/fakebase.ts` (schema + client) → first server-side query → a Server
  Action write → auth → `fakebase migrate export` / `types gen` → swap to real Supabase.
- Links into `/playground` ("try this live") and `/how-it-works`.

## Data flow

- Playground reads: Server Component → `getClientForRequest()` (cookie → registry) → kernel →
  `{ data }`. Writes: Server Action → same client → revalidate.
- No external DB. Per-visitor state lives in server memory only, ephemeral by design.
- Docs/marketing remain static; only `/playground` (+ its actions) is dynamic.

## Error handling

- Missing/expired kernel → lazy re-seed (never an error).
- Auth errors (bad password, duplicate signup) → surfaced in the panel as the real
  `error.message` from the `{ data, error }` envelope (this is itself instructive).
- Cookie not yet set on first action → create it in the action before resolving the kernel.

## Testing / verification

- **Phase A gate (de-risk first):** add the kernel deps, write one Server Action that runs
  `createMemoryKernel(schema).from("posts").select()` and renders the real `{ data, error }`;
  confirm `pnpm --filter @fakebase/web build` (Turbopack) is green — resolving `transpilePackages`
  if needed. Only then build the registry → auth → UI.
- Per phase: build + typecheck + lint green; manually exercise `/playground` (create, toggle,
  delete, reset, sign up/in/out) and confirm two browsers get isolated sandboxes.
- Final: full monorepo `build` / `typecheck` / `test` / `lint` / `format:check` green with
  `apps/playground-nextjs` removed; all internal links resolve; docs sidebar shows Getting
  Started.

## Phasing

1. **Phase A — Live playground.** De-risk proof → per-visitor registry → port schema/seed →
   CRUD UI with code+result → auth panel → reset. Delete `apps/playground-nextjs`.
2. **Phase B — Getting Started doc** (`docs/getting-started.md`).
3. **Phase C — Richer how-it-works + anatomy of a query.**
4. **Phase D — Wire `/examples` to `/playground`, nav, full verification.**

## Out of scope (YAGNI)

- Live storage/realtime writes on the marketing site (storage shown as code).
- Real per-stage kernel introspection API (intermediate anatomy stages are illustrative).
- Persisting playground data across deploys / sharing across instances (ephemeral by design).
- Auth providers beyond email+password.

## Notes

- Repo is **not** a git repository, so the design doc is written but not committed.
