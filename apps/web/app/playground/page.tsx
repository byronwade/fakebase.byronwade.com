import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, RotateCcw, Trash2 } from "lucide-react";
import { getPlaygroundClient } from "@/lib/playground/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/status-pill";
import { Section } from "@/components/section";
import { CallResult } from "@/components/playground/call-result";
import { CreatePostForm } from "@/components/playground/create-post-form";
import { AuthPanel } from "@/components/playground/auth-panel";
import {
  togglePostAction,
  deletePostAction,
  resetAction,
} from "@/app/playground/actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Playground — Fakebase",
  description:
    "A live, in-browser Fakebase sandbox. Run real Supabase-shaped queries against an in-memory kernel and watch the actual { data, error } come back.",
};

type Post = {
  id: string;
  title: string;
  body: string;
  published: boolean;
  view_count: number;
  created_at: string;
};

export default async function PlaygroundPage() {
  const supabase = await getPlaygroundClient();

  const postsRes = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });
  const posts = (postsRes.data ?? []) as Post[];

  const userRes = await supabase.auth.getUser();
  const currentEmail =
    (userRes.data as { user?: { email?: string } } | null)?.user?.email ?? null;

  return (
    <main className="mx-auto max-w-4xl px-5 py-14">
      <header className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Playground</Badge>
          <StatusPill tone="info" pulse>
            live in-memory kernel
          </StatusPill>
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Run it yourself
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          This page runs a real Fakebase kernel on the server — your own private,
          in-memory sandbox. Every action below executes the same{" "}
          <code className="font-mono text-foreground">@supabase/supabase-js</code> call
          shape you&apos;d ship, and shows the actual{" "}
          <code className="font-mono text-foreground">{"{ data, error }"}</code> it
          returns.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <form action={resetAction}>
            <Button type="submit" variant="outline" size="sm" className="gap-1.5">
              <RotateCcw className="size-3.5" />
              Reset demo data
            </Button>
          </form>
          <span className="text-xs text-muted-foreground">
            Your changes are isolated to your session and reset when you do.
          </span>
        </div>
      </header>

      {/* Read */}
      <div className="mt-12">
        <Section
          title="Read — Server Component"
          description="A select() runs during render. No client JavaScript, no API round-trip."
        >
          <div className="p-5">
            <CallResult
              code={`const { data, error } = await supabase
  .from("posts")
  .select("*")
  .order("created_at", { ascending: false });`}
              result={{ data: posts, error: null }}
              ok
            />
          </div>
        </Section>
      </div>

      {/* Posts list with mutations */}
      <div className="mt-8">
        <Section
          title="Mutate — Server Actions"
          description="Toggle or delete a row; the kernel runs update()/delete() and the page revalidates."
        >
          <ul className="divide-y divide-border">
            {posts.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-muted-foreground">
                No posts. Insert one below, or reset the demo data.
              </li>
            )}
            {posts.map((post) => (
              <li
                key={post.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{post.title}</span>
                    {post.published ? (
                      <Badge variant="success">published</Badge>
                    ) : (
                      <Badge variant="secondary">draft</Badge>
                    )}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{post.body}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <form action={togglePostAction}>
                    <input type="hidden" name="id" value={post.id} />
                    <input
                      type="hidden"
                      name="published"
                      value={String(!post.published)}
                    />
                    <Button type="submit" variant="ghost" size="sm">
                      {post.published ? "Unpublish" : "Publish"}
                    </Button>
                  </form>
                  <form action={deletePostAction}>
                    <input type="hidden" name="id" value={post.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label="Delete post"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {/* Create */}
      <div className="mt-8">
        <Section
          title="Insert — Server Action"
          description="Create a post and see the inserted row returned by .insert().select()."
        >
          <div className="p-5">
            <CreatePostForm />
          </div>
        </Section>
      </div>

      {/* Auth */}
      <div className="mt-8">
        <Section
          title="Auth — local GoTrue-shaped flows"
          description="Sign up / in / out against your sandbox's in-memory auth service."
        >
          <div className="p-5">
            <AuthPanel currentEmail={currentEmail} />
          </div>
        </Section>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/how-it-works"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
        >
          See how this works under the hood
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </main>
  );
}
