# Design — Registry migration, floating chrome, playground app

**Date:** 2026-06-02
**Status:** Approved (design); ready for implementation plan
**Scope:** Three sequenced phases with a hard dependency order: **A → B + C**.

## Goal

1. Migrate the entire website's design system to consume the now-live
   `https://ui.byronwade.com` shadcn registry (`@byronwade/*`) instead of the ~11
   hand-copied local components.
2. Rebuild navigation as the byronwade-ui **floating AppChrome** (morph nav-dock +
   ⌘K command palette + launcher/breadcrumb + contextual toolbar), replacing the
   current sticky header.
3. Turn the playground into a **full-width app**: left schema/table sidebar + top
   toolbar + main work area, with a live query console, realtime feed, auth, and
   SQL/types export.

## Findings that shaped the design (verified during brainstorming)

- **Local component drift is cosmetic only.** `button`/`badge` differ from the
  registry source *only* in semicolons + Prettier line-wrapping; logic is
  byte-identical. Overwriting via `shadcn add` is safe (Prettier reformats on commit).
- **Dock tokens already exist locally** (`--dock`, `--dock-active`,
  `--dock-active-foreground`, `--dock-foreground`, `--dock-muted` in
  `app/foundation.generated.css`) → the nav-dock renders styled. Re-pull
  `foundation` in Phase A anyway to refresh against the deployed source.
- **The kernel does NOT cleanly bundle for the browser.** `core`, `client`, and
  `realtime` are node-free, but `adapter-memory` imports `node:os`, `node:path`,
  `node:crypto`. → **Interactive playground features stay server-side.** No
  client-side kernel, no node shims.
- **Per-visitor kernel is a module-global singleton** keyed by the `fb_pg` cookie
  (`lib/playground/client.ts`). An SSE route handler and a Server Action for the
  same visitor resolve the *same* kernel instance → realtime pub/sub works across
  requests.
- Vendored scope is now `@byronwade/fakebase` / `@byronwade/seed`.

---

## Phase A — Design-system migration (ships first, gated)

**Deliverable:** the site builds and every existing route renders, now sourcing
components from the live registry.

1. **`components.json`** at repo root:
   - `aliases`: `components` → `@/components`, `ui` → `@/components/ui`,
     `lib` → `@/lib`, `utils` → `@/lib/utils`, `hooks` → `@/hooks`.
   - `tailwind.css` → `app/globals.css`; `cssVariables: true`; `rsc: true`;
     `tsx: true`; base color neutral. Alias matches existing `@/*` → `./*`.
   - Register the namespaced registry: `registries["@byronwade"]` →
     `https://ui.byronwade.com/r/{name}.json`.
2. **Spike the installer (first plan step, before bulk install):**
   `npx shadcn@latest add @byronwade/dialog`. Confirm it (a) writes to
   `components/ui/dialog.tsx`, (b) installs deps cleanly in this pnpm + vendored
   `file:` workspace.
   - **Fallback if it chokes:** fetch `/r/{name}.json` over HTTP and write
     `files[].content` to `files[].target`, then `pnpm add` the listed npm deps
     manually (the memory copy-path, now over HTTP).
3. **Re-pull `foundation`**, then **`add @byronwade/all`** (60 components) → fills
   `components/ui/*` and `components/*` with select, dialog, dropdown-menu, command,
   sheet, navigation-menu, morph-dock, popover, scroll-area, etc.
4. **Rewire** existing imports if any component moved location; delete superseded
   local copies. New npm deps land in `package.json` (e.g. `sonner`, chart's
   `recharts`-equivalent, base-ui subpaths).
5. **Gate:** `pnpm build` + `pnpm typecheck` pass; manually verify home,
   how-it-works, docs, examples, playground still render. Commit before B/C.

---

## Phase B — Floating AppChrome navigation

**Deliverable:** the byronwade-ui floating chrome, adapted to Fakebase routes,
replacing the sticky `SiteNav`.

1. **`components/chrome/`** (ported from byronwade-ui `app/_components/chrome/`):
   - `app-chrome.tsx` — assembles the four pieces; `pointer-events-none` group.
   - `nav-dock.tsx` — morph pill → ⌘K spotlight. Built on registry `tooltip`;
     reuses the proven morph technique (inline width/height/border-radius animation,
     ResizeObserver, reduced-motion fallback, View-Transition theme swap).
   - `nav-config.ts` — Fakebase destinations: Home · How it works · Playground ·
     Docs · Examples (with `match` predicates).
   - `app-launcher.tsx` + `app-breadcrumb.tsx` — identity pill + breadcrumb trail
     (Fakebase logo/wordmark; breadcrumb derived from pathname).
   - `dock-toolbar.tsx` — contextual top-right pill (page-specific actions; empty
     on routes with none).
2. **Search index** (`lib/search-index.ts`) the ⌘K palette queries: site pages +
   doc sections + examples. Static, typed (`{ label, href, kind, meta?, keywords? }`).
3. **`layout.tsx`:** remove `<SiteNav />`; mount `<AppChrome />` and `<Toaster />`
   (registry `sonner`). Keep `<SiteFooter />`.
4. **Top-padding audit:** every route loses the sticky header → review/adjust top
   spacing on home, how-it-works, docs (sidebar layout), examples, playground so the
   floating chrome doesn't overlap content.
5. **Gate:** keyboard ⌘K opens/closes; nav active-states correct on every route;
   no overlap; mobile dock floats bottom.

---

## Phase C — Full-width playground app

**Deliverable:** `/playground` as a full-bleed studio. Layout: **left sidebar +
top toolbar + main**.

**Shell** (`app/playground/page.tsx` + `components/playground/`):
- `playground-shell.tsx` — full-bleed grid (sidebar / toolbar / main); no
  `max-w-4xl`.
- `playground-toolbar.tsx` — Run · Reset (existing `resetAction`) · Export · live
  status dot (registry `status-dot`).
- `table-sidebar.tsx` — lists `users · posts · comments` from `playgroundSchema`
  with column counts; selecting sets the active table (URL search param
  `?table=`).

**Feature panels** (tabbed in main via registry `tabs`):
1. **Browse / Read** — active table's rows in a registry `table`, fetched in the
   Server Component (`select("*")`). Demonstrates SSR reads.
2. **Query console** — editable `.from(table).select(...)` chain. A Server Action
   parses a constrained query spec (table + columns + optional `eq`/`order`/`limit`
   — **not** arbitrary eval) and runs it against the visitor's server kernel,
   returning real `{ data, error }`. Reuses `CallResult`.
3. **Mutate / Insert** — existing toggle/delete/insert server actions
   (`togglePostAction`, `deletePostAction`, `CreatePostForm`).
4. **Realtime** — new **SSE route** `app/playground/realtime/stream/route.ts`:
   `getPlaygroundClient()` → subscribe to the kernel's
   `postgres_changes` channel → forward events as `text/event-stream`. A
   `realtime-feed.tsx` client component opens an `EventSource` and renders a live
   event log; inserts via the Insert panel trigger visible events. Verify the
   kernel exposes `.channel()/on("postgres_changes")/subscribe()` programmatically
   (fidelity matrix lists realtime as "close"); if the API differs, adapt the
   subscription call.
5. **Auth** — existing `AuthPanel` flows.
6. **Export** — render Supabase SQL + `database.types.ts` from `playgroundSchema`.
   Verify a programmatic export exists in `@byronwade/fakebase` / migrations
   (the CLI does `migrate export --supabase` / `types gen`); if only CLI-level,
   call the underlying generator function directly. Display in a registry
   `tabs` + `code-block` with copy.

**Gates:** sidebar switches tables; query console returns real results; realtime
feed updates on insert within the same session; export renders valid SQL/types;
`pnpm build` + `pnpm typecheck` pass.

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| `shadcn add` mis-resolves in pnpm + vendored workspace | Spike one component first; HTTP-fetch fallback documented. |
| `@byronwade/all` pulls heavy deps (chart/recharts, sonner) | Acceptable per user (full catalog). Verify build size after install. |
| Realtime kernel API differs from Supabase channel shape | Verify `.channel()` API in `@byronwade/fakebase` before wiring SSE; adapt. |
| Programmatic SQL/types export may be CLI-only | Locate the underlying generator in migrations/core; call directly. |
| Floating chrome overlaps content site-wide | Explicit top-padding audit is a Phase B work item, not an afterthought. |

## Out of scope

- RLS policy editor, storage browser, OAuth flows (kernel-unsupported / capability-gated).
- Persisting playground edits beyond the per-visitor TTL.
- Redesigning marketing copy or docs content (chrome/layout only).
