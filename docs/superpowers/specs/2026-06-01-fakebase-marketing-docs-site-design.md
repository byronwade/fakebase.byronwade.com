# Fakebase Marketing + Docs Site — Design

**Date:** 2026-06-01
**Status:** Approved-pending-review
**Author:** Byron Wade (with Claude)

## Goal

Build the public-facing surface for Fakebase — marketing landing, a "how it works" page,
rendered documentation, and an examples/playground showcase — as a single Next.js app that
consumes the **byronwade/ui** design system (`/Users/byronwade/byronwade-ui`). Replace the
current `apps/docs` stub (a single hardcoded page that uses no design system and renders none
of the existing `docs/*.md`).

## Audit summary (the "find problems" pass)

The monorepo is healthy. Full suite run on 2026-06-01:

| Check                                                       | Result                          |
| ----------------------------------------------------------- | ------------------------------- |
| `pnpm build` (38 turbo tasks)                               | pass                            |
| `pnpm typecheck`                                            | pass                            |
| `pnpm test` (28 tasks, incl. pglite adapter contract suite) | pass                            |
| `pnpm lint`                                                 | 0 errors, 7 unused-var warnings |
| `pnpm format:check`                                         | clean                           |
| TODO/FIXME scan in `packages/*/src` + `apps/*/app`          | none                            |

The only genuine issues:

1. **7 unused-var ESLint warnings** — fix in Phase 4:
   - `packages/core/src/__tests__/store.test.ts` — `FakebaseErrorCode`
   - `packages/migrations/src/schema-parser.ts:153` — unused eslint-disable directive
   - `packages/migrations/src/snapshot.ts:180` — unused arg `m`
   - `packages/client/src/__tests__/create-client.test.ts:8` — `beforeEach`
   - `packages/client/src/__tests__/database-builder.test.ts:8` — `beforeEach`
   - `packages/client/src/realtime-client.ts:10` — `RealtimePayload`
   - `packages/auth/src/__tests__/local-auth.test.ts:1` — `beforeEach`
2. **The docs app is a stub.** `apps/docs/app/page.tsx` is one hardcoded page with manual
   Tailwind classes; the rich `docs/*.md` content is never rendered anywhere. This is the
   build task, not a bug.

No padding: nothing else is broken.

## Decisions (locked with user)

- **New app `apps/web`** holds everything (marketing + how-it-works + docs + examples).
  The old `apps/docs` is **deleted** in Phase 4.
- **Stack: newest and best only.** Match byronwade/ui exactly: **Next 16, React 19.2,
  Tailwind v4**, latest `shadcn` / `lucide-react` / `@base-ui/react` / `next-themes`. Tailwind
  v4 is scoped to this app via its own `postcss.config.mjs`, so it cannot leak into the
  remaining v3 apps. The version delta vs the rest of the monorepo (Next 15 / TW v3) is
  accepted on purpose — pnpm workspaces isolate per-package versions, and `apps/web` is a leaf
  app (nothing imports from it).
- **Docs rendering:** latest `react-markdown` + `remark-gfm` at runtime, styled with the design
  system's typography, in a sidebar + TOC layout. Source of truth stays in root `docs/*.md`.

### Why Next 16 (newest)

byronwade/ui ships on Next 16 / React 19.2 / Tailwind v4. Per the directive to use the newest
and best, `apps/web` matches that stack exactly rather than pinning to the monorepo's older
Next 15 / TW v3. This guarantees the design system's components, custom Tailwind v4 utilities
(`@theme`, `rounded-4xl`, `stroke-success`), and token derivation behave identically to their
source repo. Risk is contained: the v4 PostCSS config is per-app, and the Phase 1 render proof
confirms `apps/web` builds under `turbo` without disturbing the v3 apps.

## Design-system consumption

The dependency graph is shallow: composites like `hero-section` depend only on
`@byronwade/foundation` + `@byronwade/utils`. byronwade/ui has a pre-built registry at
`/Users/byronwade/byronwade-ui/public/r/*.json` (each payload carries full file contents +
`cssVars`) and a `predev` that syncs it, serving `/r/*.json` on `localhost:3000`.

**Primary mechanism:** shadcn CLI against the local registry.

- `shadcn init http://localhost:3000/r/foundation.json` to lay down `globals.css` token layer
  - `components.json`, with a `"@byronwade": "http://localhost:3000/r/{name}.json"` registry
    mapping for automatic dependency resolution + brand-follows-`--brand` token derivation.

**Fallback (if the CLI is flaky against the local server):** materialize the needed items
directly from `public/r/*.json` (they contain file contents + cssVars), or copy the source
files from `registry/ui`, `registry/components`, `registry/lib/utils.ts`, plus
`app/foundation.generated.css`, and fix the `@/lib/utils` / `@/components/ui` aliases. Identical
owned code either way.

**Components expected to be used:** `foundation`, `utils`, `button`, `badge`, `card`, `table`,
`tabs`, `separator`, `sonner`, `tooltip`, plus composites `hero-section`, `page-header`,
`section`, `stat-card`, `metric-stat`, `status-pill`, `timeline-rail`, `split-with-rail`,
`empty-state`. Exact set finalized during implementation as pages are built.

**Dependencies `apps/web` will need (all latest, matching byronwade/ui):** `next@16`,
`react@19.2`, `react-dom@19.2`, `tailwindcss@4`, `@tailwindcss/postcss@4`, `tw-animate-css`,
`@base-ui/react`, `lucide-react`, `next-themes`, `clsx`, `tailwind-merge`,
`class-variance-authority`, `react-markdown`, `remark-gfm`. (Add `recharts`/`cmdk`/`sonner`
only if components that need them are actually used.)

## App structure

```
apps/web/                          Next 15 App Router
  app/
    layout.tsx                     ThemeProvider (next-themes) + nav + footer; Geist fonts
    globals.css                    foundation token layer (light + dark) from shadcn init
    page.tsx                       Marketing landing
    how-it-works/page.tsx          Kernel -> adapters -> export narrative
    examples/page.tsx              playground-nextjs + examples/ showcase
    docs/[[...slug]]/page.tsx      Renders docs/*.md (sidebar + TOC)
  components/ui/                    copied design-system primitives
  components/                       copied composites
  lib/
    utils.ts                       cn()
    docs.ts                        reads/lists root docs/*.md, extracts headings for TOC
  postcss.config.mjs               Tailwind v4 (scoped to this app only)
  next.config.ts, tsconfig.json, package.json
```

`apps/docs` is removed once `apps/web` is verified.

## Page specs

### Landing (`/`)

- `hero-section`: dev-only warning badge ("DEV-ONLY — not production auth/authorization/infra"),
  headline ("A Supabase-shaped local dev platform for Next.js"), subhead, CTAs (GitHub +
  Quick start anchor).
- Value props row (zero setup / same API surface / first-class export / honest capability labels)
  as `stat-card` or `metric-stat`.
- Quick-start code block (the README snippet) in a styled `<pre>`/code surface.
- Compatibility matrix as a design-system `table` with `status-pill`/`badge` for fidelity
  (exact / close / partial / unsupported), sourced from `docs/compatibility-matrix.md` data.
- Footer with the dev-only disclaimer + `fakebase verify supabase` reminder.

### How it works (`/how-it-works`)

- `page-header` intro.
- `timeline-rail` / `section` narrative: createClient -> kernel -> adapter
  (memory / json / sqlite / pglite) -> policy engine (RLS approximation) -> migrations/export.
- Adapter comparison `table` (fidelity vs setup cost).
- Export-to-real-Supabase steps (mirrors README "Migration to real Supabase").

### Docs (`/docs/[[...slug]]`)

- `lib/docs.ts` lists root `docs/*.md`, maps slug -> file, parses front matter/headings.
- `split-with-rail`: left sidebar = doc list; main = rendered markdown via `react-markdown` +
  `remark-gfm` with design-system prose styling; right = on-page TOC from headings.
- `/docs` (no slug) renders an index of available docs.
- Markdown code fences styled to match the landing's code surface.

### Examples (`/examples`)

- Cards (design-system `card`) linking to `apps/playground-nextjs` patterns and `examples/`.
- Copyable snippets (the server-read + `/api/*` write pattern).
- `empty-state` style callouts where relevant.

## Data flow

- Docs content is read from the repo's root `docs/` directory at build/request time by
  `lib/docs.ts` (server-side `fs`). No DB, no client fetching for docs.
- Compatibility-matrix and feature data are static arrays in the app (kept in sync with
  `docs/compatibility-matrix.md`); not dynamically parsed from markdown for the landing table.

## Error handling

- `/docs/[[...slug]]` with an unknown slug -> Next `notFound()` (404).
- `lib/docs.ts` guards against path traversal: only serves files that exist within root `docs/`.
- Build must fail loudly if the foundation tokens / `globals.css` are missing (caught by the
  Phase 1 render proof).

## Testing / verification

- **Phase 1 gate:** scaffold `apps/web`, wire foundation, render a single `<Button>` + a
  token-driven color (e.g. `bg-brand`), confirm `turbo build` includes `apps/web` and that the
  v4 PostCSS config is scoped to this app (v3 apps still build). Only then build sections.
- Per phase: `pnpm --filter @fakebase/web build` + `typecheck` + `lint` green; visually confirm
  pages render with design-system tokens (light + dark).
- Final: full `pnpm build` / `typecheck` / `test` / `lint` / `format:check` green across the
  monorepo with `apps/docs` removed.
- Verify all internal doc links resolve and the dev-only warnings are present on landing + footer.

## Phasing

1. **Phase 1 — Scaffold + DS integration + landing.** Riskiest path end-to-end. Render proof,
   then the landing page.
2. **Phase 2 — How it works.**
3. **Phase 3 — Docs rendering** (`lib/docs.ts` + `/docs/[[...slug]]`).
4. **Phase 4 — Examples page + lint-warning cleanup + delete `apps/docs`** + final monorepo
   verification + README/workspace references updated.

## Out of scope (YAGNI)

- Docs search, versioning, MDX/live components (react-markdown is enough for ~7 docs).
- Deploying the byronwade/ui registry publicly (consume locally).
- Blog, changelog UI, i18n, analytics.
- Touching package internals beyond the 7 lint-warning cleanups.

## Notes

- This repo is **not** a git repository, so the design doc is written but not committed
  (the brainstorming "commit the spec" step is N/A here).
