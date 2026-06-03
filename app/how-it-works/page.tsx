import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Check,
  Cpu,
  Database,
  FileCode,
  FileOutput,
  Layers,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CodeBlock } from "@/components/site/code-block";
import { QueryAnatomy } from "@/components/site/query-anatomy";
import { MIGRATION_STEPS } from "@/lib/site-data";

const SUPABASE_CODE = `import { createClient } from "@supabase/supabase-js";

const supabase = createClient(URL, ANON_KEY);

const { data, error } = await supabase
  .from("posts")
  .select("*")
  .eq("published", true);`;

const FAKEBASE_CODE = `import { createClient, createMemoryKernel } from "@byronwade/fakebase";

const supabase = createClient("local", "dev-key", {
  kernel: createMemoryKernel(schema),
});

const { data, error } = await supabase
  .from("posts")
  .select("*")
  .eq("published", true);`;

export const metadata: Metadata = {
  title: "How it works — Fakebase",
  description:
    "How Fakebase keeps the Supabase developer contract stable while swapping the implementation underneath: the kernel, adapters, fidelity layers, and the export path.",
};

const STACK = [
  {
    label: "Your app",
    sub: "Next.js · SvelteKit · Astro · Remix · Node — any framework",
    icon: FileCode,
    tone: "muted",
  },
  {
    label: "createClient(url, key, { kernel })",
    sub: "Supabase-shaped facade — from() · auth · storage · realtime · rpc",
    icon: PlugShape,
    tone: "brand",
  },
  {
    label: "FakebaseKernel",
    sub: "schema IR · query compiler · policy engine · capability registry",
    icon: Cpu,
    tone: "card",
  },
  {
    label: "Adapter",
    sub: "memory · json · sqlite · pglite — interchangeable persistence",
    icon: Database,
    tone: "card",
  },
];

const FIDELITY = [
  {
    n: "01",
    title: "API-shape fidelity",
    promise: "Promised",
    tone: "success" as const,
    body: "Method names, chaining, and { data, error } envelopes match @supabase/supabase-js exactly.",
  },
  {
    n: "02",
    title: "Behavior fidelity",
    promise: "Promised for supported capabilities",
    tone: "success" as const,
    body: "Insert/select/update/filter, sessions, and storage behave like Supabase for the common cases.",
  },
  {
    n: "03",
    title: "Infrastructure fidelity",
    promise: "Not promised",
    tone: "warning" as const,
    body: "True Postgres planner semantics, real RLS enforcement, edge routing, PITR. This is why Fakebase is dev-only.",
  },
];

const KERNEL_OWNS = [
  {
    icon: Layers,
    title: "Schema IR",
    body: "One normalized in-memory shape. Both the TypeScript schema DSL and SQL migrations resolve into it.",
  },
  {
    icon: Cpu,
    title: "Query compiler",
    body: "Translates a builder chain into a QueryPlan — filters, ordering, range, projection — then executes against the adapter.",
  },
  {
    icon: ShieldCheck,
    title: "Policy engine",
    body: "Compiles USING / WITH CHECK into JS predicates over (row, context) and enforces anon / authenticated / service_role grants.",
  },
  {
    icon: Boxes,
    title: "Capability registry",
    body: "Every feature carries a status. Unsupported calls throw a CapabilityError with a docs link — never a silent no-op.",
  },
];

const ADAPTERS = [
  {
    name: "memory",
    setup: "None",
    durability: "Process only",
    best: "Tests, disposable prototypes",
  },
  {
    name: "json",
    setup: "None",
    durability: ".fakebase/ files",
    best: "Small prototypes, seeds, manual editing",
  },
  {
    name: "sqlite",
    setup: "Low (native build)",
    durability: "Single-file (WAL)",
    best: "Serious local projects",
  },
  {
    name: "pglite",
    setup: "None (pure WASM)",
    durability: "Directory or in-memory",
    best: "Highest SQL fidelity, CI",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-16">
      <header className="max-w-3xl">
        <Badge variant="outline" className="mb-4">
          How it works
        </Badge>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          One contract. Swappable guts.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Fakebase is built around a single idea: keep the Supabase developer contract
          stable while swapping the implementation underneath. The compatibility logic
          lives in one place —{" "}
          <code className="font-mono text-foreground">@byronwade/core</code> — and
          everything user-facing sits on top of it.
        </p>
      </header>

      {/* Same call, swappable backend */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          The same call, a swappable backend
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Only the import and the{" "}
          <code className="font-mono text-foreground">createClient</code> line differ.
          The query you write is byte-for-byte identical — which is why migrating to
          real Supabase is a one-line swap.
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Badge variant="secondary">@supabase/supabase-js</Badge>
            <CodeBlock filename="with Supabase" code={SUPABASE_CODE} />
          </div>
          <div className="space-y-2">
            <Badge variant="success">fakebase</Badge>
            <CodeBlock filename="with Fakebase" code={FAKEBASE_CODE} />
          </div>
        </div>
      </section>

      {/* The stack */}
      <section className="mt-16">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          The request path
        </h2>
        <div className="mt-5 space-y-2">
          {STACK.map((layer, i) => (
            <div key={layer.label}>
              <div
                className={cn(
                  "flex items-center gap-4 rounded-2xl border p-4 shadow-card",
                  layer.tone === "brand"
                    ? "border-brand/30 bg-brand/5"
                    : layer.tone === "muted"
                      ? "border-border bg-muted/40"
                      : "border-border bg-card",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-10 shrink-0 items-center justify-center rounded-xl",
                    layer.tone === "brand"
                      ? "bg-brand/15 text-brand"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <layer.icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <div className="font-mono text-sm font-medium">{layer.label}</div>
                  <div className="text-sm text-muted-foreground">{layer.sub}</div>
                </div>
              </div>
              {i < STACK.length - 1 && (
                <div className="ml-9 h-2 w-px bg-border" aria-hidden />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Anatomy of a query */}
      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">Anatomy of a query</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Follow one real call all the way down and back. The shapes below are
          representative —{" "}
          <Link href="/playground" className="text-brand hover:underline">
            run the real thing live in the playground
          </Link>{" "}
          to see the actual{" "}
          <code className="font-mono text-foreground">{"{ data, error }"}</code>.
        </p>
        <div className="mt-6">
          <QueryAnatomy />
        </div>
      </section>

      {/* Fidelity layers */}
      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">
          Three layers of fidelity
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Fakebase promises the first two and is explicit that it does not promise the
          third. That honesty is the whole point.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {FIDELITY.map((f) => (
            <div
              key={f.title}
              className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-card"
            >
              <span className="font-mono text-xs text-muted-foreground">{f.n}</span>
              <h3 className="mt-2 font-medium">{f.title}</h3>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
                {f.body}
              </p>
              <Badge variant={f.tone} className="mt-4 self-start">
                {f.tone === "success" ? (
                  <Check className="size-3" />
                ) : (
                  <X className="size-3" />
                )}
                {f.promise}
              </Badge>
            </div>
          ))}
        </div>
      </section>

      {/* What the kernel owns */}
      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">What the kernel owns</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          <code className="font-mono text-foreground">FakebaseKernel</code> is
          constructed synchronously, so you can use it in module scope, Server
          Components, and Route Handlers with no async bootstrap.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {KERNEL_OWNS.map((k) => (
            <div
              key={k.title}
              className="rounded-2xl border border-border bg-card p-5 shadow-card"
            >
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <k.icon className="size-4.5" />
              </span>
              <h3 className="mt-3 font-medium">{k.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {k.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Adapters */}
      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">Pick your fidelity</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Adapters implement one persistence interface and are interchangeable without
          touching app code. Every adapter is verified against the <em>same</em>{" "}
          behavioral contract suite, so swapping never changes observable behavior.
        </p>
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Adapter</TableHead>
                <TableHead>Setup</TableHead>
                <TableHead>Durability</TableHead>
                <TableHead className="pr-5">Best for</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ADAPTERS.map((a) => (
                <TableRow key={a.name}>
                  <TableCell className="pl-5">
                    <code className="font-mono text-sm font-medium">
                      adapter-{a.name}
                    </code>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{a.setup}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.durability}
                  </TableCell>
                  <TableCell className="pr-5 text-muted-foreground">{a.best}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Export path */}
      <section className="mt-16">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-card sm:p-10">
          <div className="flex items-center gap-2 text-brand">
            <FileOutput className="size-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              Export &amp; ship
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            Fakebase is designed to be thrown away
          </h2>
          <ol className="mt-6 space-y-3">
            {MIGRATION_STEPS.map((step, i) => (
              <li key={step.cmd} className="flex gap-4">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/10 font-mono text-xs font-semibold text-brand">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <code className="font-mono text-sm text-foreground">{step.cmd}</code>
                  <p className="mt-0.5 text-sm text-muted-foreground">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/docs/architecture" className={cn(buttonVariants(), "gap-1.5")}>
              Read the architecture doc
              <ArrowRight />
            </Link>
            <Link
              href="/docs/migration-guide"
              className={buttonVariants({ variant: "outline" })}
            >
              Migration guide
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

/** Small inline plug/socket glyph (kept local to avoid a brand-icon dependency). */
function PlugShape({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 2v6M15 2v6" />
      <path d="M6 8h12v3a6 6 0 0 1-12 0V8Z" />
      <path d="M12 17v5" />
    </svg>
  );
}
