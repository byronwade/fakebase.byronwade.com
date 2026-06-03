/**
 * Static search index powering the ⌘K command palette in the floating nav dock.
 * Plain data (no `node:fs`) so it's safe to import into the client dock. Kept in
 * sync by hand with the docs ORDER in `lib/docs.ts` and the site routes.
 */

export type SearchKind = "Page" | "Doc" | "Example";

export type SearchEntry = {
  label: string;
  href: string;
  kind: SearchKind;
  /** Short right-aligned hint (e.g. the section). */
  meta?: string;
  /** Extra tokens folded into the match haystack. */
  keywords?: string;
};

/** Display order of the kind groups in the palette. */
export const SEARCH_GROUPS: { kind: SearchKind; label: string }[] = [
  { kind: "Page", label: "Pages" },
  { kind: "Doc", label: "Docs" },
  { kind: "Example", label: "Examples" },
];

export const searchIndex: SearchEntry[] = [
  // ── Primary pages ────────────────────────────────────────────────
  { label: "Home", href: "/", kind: "Page", keywords: "landing start overview fakebase" },
  {
    label: "How it works",
    href: "/how-it-works",
    kind: "Page",
    meta: "Architecture",
    keywords: "kernel adapter query anatomy under the hood",
  },
  {
    label: "Playground",
    href: "/playground",
    kind: "Page",
    meta: "Live sandbox",
    keywords: "sandbox demo run query realtime auth try it",
  },
  { label: "Docs", href: "/docs", kind: "Page", keywords: "documentation reference" },
  {
    label: "Examples",
    href: "/examples",
    kind: "Page",
    keywords: "samples templates crud auth storage realtime nextjs",
  },

  // ── Docs (mirrors ORDER in lib/docs.ts) ──────────────────────────
  { label: "Getting Started", href: "/docs/getting-started", kind: "Doc", meta: "Docs", keywords: "install setup quickstart" },
  { label: "Architecture", href: "/docs/architecture", kind: "Doc", meta: "Docs", keywords: "kernel adapter design internals" },
  { label: "Compatibility Matrix", href: "/docs/compatibility-matrix", kind: "Doc", meta: "Docs", keywords: "fidelity supabase support exact partial" },
  { label: "Migration Guide", href: "/docs/migration-guide", kind: "Doc", meta: "Docs", keywords: "swap supabase export sql seed types" },
  { label: "Fake Data Generation", href: "/docs/seeding", kind: "Doc", meta: "Docs", keywords: "seed faker data generate" },
  { label: "CLI Reference", href: "/docs/cli", kind: "Doc", meta: "Docs", keywords: "command line fakebase migrate types gen" },
  { label: "Security", href: "/docs/security", kind: "Doc", meta: "Docs", keywords: "rls policies dev only safety" },
  { label: "AI Rules & Prompts", href: "/docs/ai-rules", kind: "Doc", meta: "Docs", keywords: "ai cursor prompt rules" },
  { label: "Admin UI", href: "/docs/admin-ui", kind: "Doc", meta: "Docs", keywords: "dashboard studio admin" },

  // ── Examples ─────────────────────────────────────────────────────
  { label: "App Router — Basic CRUD", href: "/examples", kind: "Example", meta: "Example", keywords: "server components actions notes create toggle delete" },
  { label: "SSR Auth", href: "/examples", kind: "Example", meta: "Example", keywords: "sign in up out session ssr supabase" },
  { label: "Storage & Realtime", href: "/examples", kind: "Example", meta: "Example", keywords: "upload files sse realtime bus" },
];
