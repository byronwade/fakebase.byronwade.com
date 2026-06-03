import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  FileOutput,
  PlugZap,
  ShieldAlert,
  Terminal,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { StatusPill } from "@/components/status-pill";
import { GithubIcon } from "@/components/site/github-icon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CodeBlock } from "@/components/site/code-block";
import {
  COMPAT_MATRIX,
  FIDELITY_LABEL,
  FIDELITY_TONE,
  MIGRATION_STEPS,
  NPM_URL,
  QUICK_START,
  REPO_URL,
} from "@/lib/site-data";

const VALUE_PROPS = [
  {
    icon: Zap,
    title: "Zero setup",
    body: "No Docker, no local Postgres. createMemoryKernel() or a .fakebase/ JSON folder and you're writing data.",
  },
  {
    icon: PlugZap,
    title: "Same API surface",
    body: "from().select().eq(), auth, storage, realtime, rpc — the exact @supabase/supabase-js call shape.",
  },
  {
    icon: FileOutput,
    title: "First-class export",
    body: "Generate supabase/migrations/*.sql, seed.sql, and database.types.ts that drop into a real project.",
  },
  {
    icon: ShieldAlert,
    title: "Honest capabilities",
    body: "Unsupported features throw a structured CapabilityError instead of silently faking behavior.",
  },
];

const FLOW = [
  {
    icon: Terminal,
    title: "Code against the contract",
    body: "Write your app against the @supabase/supabase-js client shape — any framework, today, with no backend.",
  },
  {
    icon: Boxes,
    title: "Pick your fidelity",
    body: "Swap the kernel adapter — memory, JSON, SQLite, or real Postgres-in-WASM (pglite) — without touching app code.",
  },
  {
    icon: FileOutput,
    title: "Export & ship",
    body: "Emit Supabase-compatible SQL, seeds, and types, verify against real Postgres, then swap createClient.",
  },
];

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div className="bg-grid absolute inset-0 -z-10 opacity-60" />
        <div className="glow-brand absolute inset-x-0 top-0 -z-10 h-[420px]" />
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-20 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
                <TriangleAlert className="size-3.5" />
                Dev-only — not production auth, authorization, or infrastructure
              </span>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <GithubIcon className="size-3.5" />
                Open source · built with Claude Code
              </a>
            </div>
            <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              The Supabase developer experience,{" "}
              <span className="text-gradient-brand">running locally</span>.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
              Fakebase mimics the developer-facing shape of Supabase, backed by an
              in-process kernel. Build prototypes at zero-setup speed anywhere{" "}
              <code className="font-mono text-foreground">@supabase/supabase-js</code>{" "}
              runs, then export real Supabase SQL migrations and{" "}
              <code className="font-mono text-foreground">database.types.ts</code> when
              you&apos;re ready to ship.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/how-it-works"
                className={cn(buttonVariants({ size: "lg" }), "gap-1.5")}
              >
                See how it works
                <ArrowRight />
              </Link>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "gap-1.5",
                )}
              >
                <GithubIcon className="size-4" />
                GitHub
              </a>
            </div>
            <a
              href={NPM_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-block font-mono text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="select-none text-brand">$</span> pnpm add @byronwade/fakebase
            </a>
          </div>

          <div className="mx-auto mt-14 max-w-2xl">
            <CodeBlock filename="lib/fakebase.ts" code={QUICK_START} />
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUE_PROPS.map((v) => (
            <div
              key={v.title}
              className="rounded-2xl border border-border bg-card p-5 shadow-card transition-colors hover:border-brand/40"
            >
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <v.icon className="size-4.5" />
              </span>
              <h3 className="mt-4 font-medium">{v.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {v.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works teaser */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">
            Fast today, honest about tomorrow
          </h2>
          <p className="mt-3 text-muted-foreground">
            Fakebase is designed to be thrown away. The point is to get you to a working
            prototype, then out of the way — on the exact contract you&apos;ll ship
            against.
          </p>
        </div>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
          {FLOW.map((step, i) => (
            <div key={step.title} className="bg-card p-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <step.icon className="size-4 text-brand" />
                <span className="font-mono text-xs">0{i + 1}</span>
              </div>
              <h3 className="mt-3 font-medium">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            Read the full walkthrough
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* Why I built it */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-card sm:p-12">
          <div className="glow-brand absolute -right-24 -top-24 -z-10 h-64 w-64 opacity-40" />
          <span className="text-xs font-semibold uppercase tracking-wide text-brand">
            Why I built Fakebase
          </span>
          <div className="mt-5 max-w-2xl space-y-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            <p>
              I kept hitting the same wall while prototyping — especially with AI in the
              loop. I wanted to move fast on a design and have the schema and migrations
              come along for the ride, instead of stopping to re-provision a database
              and hand-sync migrations every time the shape of an idea changed.
            </p>
            <p>
              So Fakebase is the tool I wanted: spin up a Supabase-shaped backend
              in-process, iterate on a near&#8209;launch&#8209;ready prototype as fast
              as you (or your AI) can change your mind, and when it settles,{" "}
              <span className="text-foreground">export real migrations and types</span>{" "}
              instead of rewriting them. Quick and easy for prototyping, honest about
              the path to production.
            </p>
          </div>
          <div className="mt-7 flex items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-brand/10 font-semibold text-brand">
              B
            </span>
            <div className="text-sm">
              <p className="font-medium text-foreground">Byron Wade</p>
              <p className="text-muted-foreground">Creator of Fakebase</p>
            </div>
          </div>
        </div>
      </section>

      {/* Compatibility matrix */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">
            Honest capability labels
          </h2>
          <p className="mt-3 text-muted-foreground">
            Every Supabase-shaped API is labeled by how faithfully Fakebase reproduces
            it. No silent gaps.
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Area</TableHead>
                <TableHead>Fidelity</TableHead>
                <TableHead className="pr-5">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COMPAT_MATRIX.map((row) => (
                <TableRow key={row.area}>
                  <TableCell className="pl-5 font-medium">{row.area}</TableCell>
                  <TableCell>
                    <StatusPill tone={FIDELITY_TONE[row.fidelity]}>
                      {FIDELITY_LABEL[row.fidelity]}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="pr-5 text-muted-foreground">
                    {row.note}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Full method-by-method matrix lives in the{" "}
          <Link
            href="/docs/compatibility-matrix"
            className="text-brand hover:underline"
          >
            docs
          </Link>
          .
        </p>
      </section>

      {/* Migration path */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-card sm:p-12">
          <h2 className="text-3xl font-semibold tracking-tight">
            The path to real Supabase is short
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Five steps from local prototype to production-ready Supabase project.
          </p>
          <ol className="mt-8 space-y-3">
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
            <Link
              href="/docs/migration-guide"
              className={cn(buttonVariants({ variant: "default" }), "gap-1.5")}
            >
              Migration guide
              <ArrowRight />
            </Link>
            <Link href="/examples" className={buttonVariants({ variant: "outline" })}>
              Browse examples
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
