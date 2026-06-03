# Registry migration, floating chrome, playground app — Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox (`- [ ]`) syntax. Three phases, hard order A → B → C, with a build/render gate after each.

**Goal:** Migrate the site onto the live `@byronwade/*` shadcn registry, replace the sticky header with byronwade-ui's floating AppChrome, and rebuild `/playground` as a full-width studio app.

**Architecture:** Server-side kernel stays authoritative (no browser kernel — `adapter-memory` uses node built-ins). Query console = Server Action; realtime = SSE route over the per-visitor module-global kernel. Nav chrome ported from `/Users/byronwade/byronwade-ui/app/_components/chrome/`.

**Tech Stack:** Next 16 / React 19.2, Tailwind v4, base-ui, shadcn registry, `@byronwade/fakebase` (vendored), SSE/EventSource.

**Spec:** `docs/superpowers/specs/2026-06-02-registry-chrome-playground-app-design.md`

**Verified APIs:**
- Realtime: `client.channel(name).on("postgres_changes", { event: "INSERT"|"UPDATE"|"DELETE"|"*", schema?: "public", table?: "posts" }, (payload) => …).subscribe(status => …)`. Payload: `{ eventType, schema, table, new, old, commit_timestamp, errors }`. Teardown: `await channel.unsubscribe()` / `await client.removeChannel(channel)`.

---

## Phase A — Design-system migration

### Task A1: shadcn config + installer spike
**Files:** Create `components.json`.
- [ ] Write `components.json` (registry `@byronwade` → `https://ui.byronwade.com/r/{name}.json`, aliases match `@/*`).
- [ ] Spike: `npx shadcn@latest add @byronwade/dialog`. Confirm it writes `components/ui/dialog.tsx` + installs deps. If it fails, switch to HTTP fallback (fetch `/r/{name}.json`, write `files[].content` to `target`, `pnpm add` deps).
- [ ] Record which path works in the commit message.

### Task A2: Install foundation + full catalog
- [ ] Re-pull `foundation`; then `add @byronwade/all` (or loop the registry items via the fallback).
- [ ] `pnpm install` to settle new deps (sonner, chart deps, base-ui subpaths).
- [ ] Delete any now-duplicated local component files superseded by registry targets.

### Task A3: Gate A
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm build` passes.
- [ ] Manually load `/`, `/how-it-works`, `/docs`, `/examples`, `/playground` — all render.
- [ ] Commit: `feat: migrate design system to live @byronwade registry`.

---

## Phase B — Floating AppChrome

### Task B1: Port chrome primitives
**Files:** Create `components/chrome/{app-chrome,nav-dock,nav-config,app-launcher,app-breadcrumb,dock-toolbar}.tsx`, `lib/breadcrumb-trail.ts`.
- [ ] Port the six files verbatim from `/Users/byronwade/byronwade-ui/app/_components/chrome/`, rewriting imports to this app's aliases and registry tooltip.
- [ ] Rewrite `nav-config.ts` destinations to Fakebase routes: Home `/`, How it works `/how-it-works`, Playground `/playground`, Docs `/docs`, Examples `/examples`.
- [ ] Swap GitHub URL to `REPO_URL` from `lib/site-data.ts`; swap logo to `components/site/logo.tsx`.

### Task B2: Search index
**Files:** Create `lib/search-index.ts`.
- [ ] Build a typed `searchIndex: SearchEntry[]` (`{ label, href, kind: "Section"|"Component"|"Page", meta?, keywords? }`) covering site pages, doc sections, and examples. Point nav-dock at it.

### Task B3: Mount chrome, remove header
**Files:** Modify `app/layout.tsx`; audit route top-padding.
- [ ] Remove `<SiteNav />`; mount `<AppChrome />` + `<Toaster />` (registry sonner). Keep footer.
- [ ] Audit/adjust top padding on `/`, `/how-it-works`, `/docs` (sidebar layout), `/examples`, `/playground` so floating chrome doesn't overlap.

### Task B4: Gate B
- [ ] ⌘K opens/closes the palette; results navigate. Active nav state correct per route. Mobile dock floats bottom. `pnpm build` + `typecheck` pass. Commit.

---

## Phase C — Full-width playground app

### Task C1: App shell + table sidebar
**Files:** Create `components/playground/{playground-shell,playground-toolbar,table-sidebar}.tsx`; modify `app/playground/page.tsx`.
- [ ] Replace `max-w-4xl` with full-bleed grid: sidebar / toolbar / main.
- [ ] Sidebar lists `users·posts·comments` from `playgroundSchema` with column counts; active table via `?table=` search param.
- [ ] Toolbar: Run · Reset (`resetAction`) · Export · live `status-dot`.

### Task C2: Browse/Read + Mutate/Insert in main
- [ ] Active table rows in registry `table` (Server Component `select("*")`).
- [ ] Keep `togglePostAction`/`deletePostAction`/`CreatePostForm` in a Mutate tab.

### Task C3: Query console (Server Action)
**Files:** Modify `app/playground/actions.ts`; create `components/playground/query-console.tsx`.
- [ ] Server Action takes a constrained spec `{ table, columns, eq?, order?, limit? }` (NOT eval), runs it on the visitor kernel, returns `{ data, error }`. Render via `CallResult`.

### Task C4: Realtime SSE
**Files:** Create `app/playground/realtime/stream/route.ts`, `components/playground/realtime-feed.tsx`.
- [ ] SSE route: `getPlaygroundClient()` → `channel("pg").on("postgres_changes",{event:"*"},cb).subscribe()` → forward each payload as `data: <json>\n\n` (text/event-stream). Clean up channel on `req.signal` abort.
- [ ] Client `EventSource` renders a live event log; inserts (C2) appear within the session.

### Task C5: Export panel
**Files:** create `components/playground/export-panel.tsx`; investigate export API in `@byronwade/fakebase`/migrations.
- [ ] Find programmatic SQL + types generators (or call the CLI's underlying functions). Render Supabase SQL + `database.types.ts` from `playgroundSchema` in tabs + code-block with copy.

### Task C6: Gate C
- [ ] Sidebar switches tables; console returns real results; realtime updates on insert; export renders valid SQL/types; `pnpm build` + `typecheck` pass. Commit.
