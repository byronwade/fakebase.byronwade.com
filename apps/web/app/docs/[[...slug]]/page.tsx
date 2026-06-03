import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";
import { getDoc, listDocs } from "@/lib/docs";
import { Markdown } from "@/components/site/markdown";
import { DocsToc } from "@/components/site/docs-toc";

export const dynamicParams = false;

type Params = { slug?: string[] };

export function generateStaticParams(): Params[] {
  return [{ slug: [] }, ...listDocs().map((d) => ({ slug: [d.slug] }))];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!slug || slug.length === 0) {
    return { title: "Documentation — Fakebase" };
  }
  const doc = getDoc(slug[0]);
  return { title: doc ? `${doc.title} — Fakebase docs` : "Documentation — Fakebase" };
}

export default async function DocsPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;

  // Index route
  if (!slug || slug.length === 0) {
    const docs = listDocs();
    return (
      <article className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">Documentation</h1>
        <p className="mt-3 text-muted-foreground">
          Everything about Fakebase — the architecture, the CLI, the compatibility
          guarantees, and how to migrate to a real Supabase project.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {docs.map((doc) => (
            <Link
              key={doc.slug}
              href={`/docs/${doc.slug}`}
              className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:border-brand/40"
            >
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <FileText className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 font-medium">
                  {doc.title}
                  <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </span>
              </span>
            </Link>
          ))}
        </div>
      </article>
    );
  }

  const doc = getDoc(slug[0]);
  if (!doc) notFound();

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_180px] xl:gap-10">
      <article className="min-w-0">
        <Markdown>{doc.content}</Markdown>
      </article>
      <DocsToc headings={doc.headings} />
    </div>
  );
}
