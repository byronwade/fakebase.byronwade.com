import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Database, KeyRound, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/site/code-block";
import { REPO_URL } from "@/lib/site-data";

const EXAMPLES = [
  {
    icon: Database,
    title: "App Router — Basic CRUD",
    dir: "examples/nextjs-app-router-basic",
    body: "The smallest useful Fakebase app: a notes list with create / toggle / delete, built entirely with Server Components + Server Actions. No API routes, no client JS.",
    tags: ["Server Components", "Server Actions"],
  },
  {
    icon: KeyRound,
    title: "SSR Auth",
    dir: "examples/nextjs-ssr-auth",
    body: "Server-rendered auth: sign up / in / out as Server Actions, with the page gated on the server-read session — the same structure you'll use with @supabase/ssr in production.",
    tags: ["Auth", "Sessions", "SSR"],
  },
  {
    icon: Radio,
    title: "Storage & Realtime",
    dir: "examples/nextjs-storage-realtime",
    body: "Upload / list / delete files via Server Actions (bytes land in .fakebase/storage/), plus the in-process realtime bus bridged to the browser over Server-Sent Events.",
    tags: ["Storage", "Realtime", "SSE"],
  },
];

const PLAYGROUND_SNIPPET = `// Server Component — read directly from the kernel
import { supabase } from "@/lib/fakebase";

export default async function PostsPage() {
  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  return <PostList posts={posts ?? []} />;
}

// Client writes go through a Route Handler:
//   app/api/posts/route.ts  ->  supabase.from("posts").insert(...)`;

export const metadata: Metadata = {
  title: "Examples — Fakebase",
  description:
    "Focused usage references for Fakebase: basic CRUD, SSR auth, storage and realtime, plus a full end-to-end playground app. Shown in Next.js; the patterns apply anywhere @supabase/supabase-js runs.",
};

export default function ExamplesPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-16">
      <header className="max-w-3xl">
        <Badge variant="outline" className="mb-4">
          Examples
        </Badge>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Patterns you can copy
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Each example is a focused, runnable app showing one slice of Fakebase, written
          in Next.js here for concreteness. The kernel is server-only, so reads happen
          on the server and client writes go through your framework&apos;s API routes.
        </p>
      </header>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXAMPLES.map((ex) => (
          <a
            key={ex.title}
            href={`${REPO_URL}/tree/main/${ex.dir}`}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-card transition-colors hover:border-brand/40"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <ex.icon className="size-4.5" />
              </span>
              <ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-brand" />
            </div>
            <h2 className="mt-4 font-medium">{ex.title}</h2>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
              {ex.body}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {ex.tags.map((t) => (
                <Badge key={t} variant="secondary">
                  {t}
                </Badge>
              ))}
            </div>
          </a>
        ))}
      </div>

      {/* The pattern */}
      <section className="mt-16 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            The server-read, route-write pattern
          </h2>
          <p className="mt-3 text-muted-foreground">
            The Fakebase kernel is backed by Node built-ins (
            <code className="font-mono text-foreground">fs</code>,{" "}
            <code className="font-mono text-foreground">crypto</code>), so it must run
            on the server. Read in Server Components; have Client Components call Server
            Actions or Route Handlers for mutations. The live{" "}
            <Link href="/playground" className="text-brand hover:underline">
              Playground
            </Link>{" "}
            wires up posts and auth this way — and shows the real{" "}
            <code className="font-mono text-foreground">{"{ data, error }"}</code> at
            every step.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/playground" className={cn(buttonVariants(), "gap-1.5")}>
              Open the live playground
              <ArrowUpRight className="size-4" />
            </Link>
            <Link
              href="/docs/migration-guide"
              className={buttonVariants({ variant: "outline" })}
            >
              Migration guide
            </Link>
          </div>
        </div>
        <CodeBlock filename="app/posts/page.tsx" code={PLAYGROUND_SNIPPET} />
      </section>
    </main>
  );
}
