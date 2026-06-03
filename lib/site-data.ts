/** Shared content for the marketing/docs site. Kept in sync with the root docs/. */

export const REPO_URL = "https://github.com/byronwade/fakebase.byronwade.com";
export const NPM_URL = "https://www.npmjs.com/package/@byronwade/fakebase";

export const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/playground", label: "Playground" },
  { href: "/docs", label: "Docs" },
  { href: "/examples", label: "Examples" },
];

export type Fidelity = "exact" | "close" | "partial" | "unsupported";

export const FIDELITY_LABEL: Record<Fidelity, string> = {
  exact: "Exact",
  close: "Close",
  partial: "Partial",
  unsupported: "Unsupported",
};

/** Maps a fidelity to a design-system StatusPill tone. */
export const FIDELITY_TONE: Record<
  Fidelity,
  "success" | "info" | "warning" | "danger"
> = {
  exact: "success",
  close: "info",
  partial: "warning",
  unsupported: "danger",
};

export const COMPAT_MATRIX: { area: string; fidelity: Fidelity; note: string }[] = [
  {
    area: "Database CRUD + filters",
    fidelity: "exact",
    note: "from().select().eq()… order / range / single",
  },
  {
    area: "Generated types",
    fidelity: "exact",
    note: "database.types.ts from schema IR",
  },
  {
    area: "Migrations + SQL export",
    fidelity: "exact",
    note: "Supabase-compatible SQL + seed.sql",
  },
  {
    area: "RPC (rpc / functions.invoke)",
    fidelity: "close",
    note: "Local function registry",
  },
  {
    area: "Auth (password / OTP / sessions)",
    fidelity: "close",
    note: "Local GoTrue-shaped flows",
  },
  {
    area: "Storage (buckets / objects / URLs)",
    fidelity: "close",
    note: "Local filesystem + signed tokens",
  },
  {
    area: "Realtime (broadcast / changes)",
    fidelity: "close",
    note: "In-process pub/sub",
  },
  {
    area: "RLS policies",
    fidelity: "partial",
    note: "Dev approximation — verify on real Postgres",
  },
  {
    area: "OAuth / SSO / MFA / passkeys",
    fidelity: "unsupported",
    note: "Capability-gated errors",
  },
];

export const QUICK_START = `import { createClient, createMemoryKernel } from "@byronwade/fakebase";
import schema from "./fakebase/schema";

const kernel = createMemoryKernel(schema);
export const supabase = createClient("local", "dev-key", { kernel });

// Same call shape as @supabase/supabase-js:
const { data, error } = await supabase
  .from("posts")
  .select("*")
  .eq("published", true)
  .order("created_at", { ascending: false });`;

export const MIGRATION_STEPS: { cmd: string; desc: string }[] = [
  {
    cmd: "fakebase migrate export --supabase",
    desc: "Write supabase/migrations/*.sql from your schema IR.",
  },
  { cmd: "fakebase seed export", desc: "Generate supabase/seed.sql from local data." },
  {
    cmd: "fakebase types gen",
    desc: "Emit database.types.ts — identical shape to Supabase's generator.",
  },
  {
    cmd: "fakebase verify supabase",
    desc: "Run the compatibility suite against a real Supabase stack.",
  },
  {
    cmd: "swap createClient",
    desc: "Replace fakebase's createClient with @supabase/supabase-js. Done.",
  },
];
