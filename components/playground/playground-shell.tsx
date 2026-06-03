"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw, Trash2 } from "lucide-react";
import {
  togglePostAction,
  deletePostAction,
  resetAction,
} from "@/app/playground/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableSidebar, type TableMeta } from "@/components/playground/table-sidebar";
import { QueryConsole, type SchemaTable } from "@/components/playground/query-console";
import { RealtimeFeed } from "@/components/playground/realtime-feed";
import { ExportPanel } from "@/components/playground/export-panel";
import { CreatePostForm } from "@/components/playground/create-post-form";
import { AuthPanel } from "@/components/playground/auth-panel";

type Row = Record<string, unknown>;
type Post = {
  id: string;
  title: string;
  body: string;
  published: boolean;
};

const TABS = [
  { value: "browse", label: "Browse" },
  { value: "query", label: "Query console" },
  { value: "mutate", label: "Mutate" },
  { value: "realtime", label: "Realtime" },
  { value: "auth", label: "Auth" },
  { value: "export", label: "Export" },
] as const;

/**
 * The full-width playground studio shell: a left table rail, a top action bar,
 * and a tabbed work area. Reads (Browse) come from the server-rendered rows for
 * the active `?table=`; everything else is interactive against the same kernel.
 */
export function PlaygroundShell({
  tables,
  schemaTables,
  activeTable,
  rows,
  columns,
  posts,
  currentEmail,
}: {
  tables: TableMeta[];
  schemaTables: SchemaTable[];
  activeTable: string;
  rows: Row[];
  columns: string[];
  posts: Post[];
  currentEmail: string | null;
}) {
  const [tab, setTab] = React.useState<string>("browse");

  return (
    <div className="full-bleed flex min-h-[calc(100dvh-3.5rem)] flex-col pt-16">
      {/* Toolbar */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-card/40 px-4 py-2.5 backdrop-blur sm:px-6">
        <div className="flex items-center gap-2">
          <StatusDot tone="info" pulse />
          <span className="text-sm font-medium">Fakebase Studio</span>
          <Badge variant="outline" className="font-mono text-[11px]">
            {activeTable}
          </Badge>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {rows.length} {rows.length === 1 ? "row" : "rows"}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setTab("export")}
          >
            Export SQL & types
          </Button>
          <form action={resetAction}>
            <Button type="submit" variant="outline" size="sm" className="gap-1.5">
              <RotateCcw className="size-3.5" />
              Reset data
            </Button>
          </form>
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-border bg-card/20 p-3 lg:border-b-0 lg:border-r">
          <TableSidebar tables={tables} activeTable={activeTable} />
          <p className="mt-4 px-2 text-[11px] leading-relaxed text-muted-foreground">
            A live, per-visitor kernel. Changes are isolated to your session and reset
            when you do.
          </p>
        </aside>

        <main className="min-w-0 p-4 sm:p-6">
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="space-y-5">
            <TabsList className="flex-wrap">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Browse — server-rendered rows for the active table */}
            <TabsContent value="browse" className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <code className="font-mono text-foreground">
                  await supabase.from({JSON.stringify(activeTable)}).select(&quot;*&quot;)
                </code>{" "}
                — run during render in a Server Component.
              </p>
              <BrowseTable rows={rows} columns={columns} />
            </TabsContent>

            {/* Query console */}
            <TabsContent value="query">
              <QueryConsole tables={schemaTables} initialTable={activeTable} />
            </TabsContent>

            {/* Mutate / Insert — posts CRUD via Server Actions */}
            <TabsContent value="mutate" className="space-y-6">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Insert a post</h3>
                <CreatePostForm />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  Existing posts — toggle or delete
                </h3>
                <PostList posts={posts} />
              </div>
            </TabsContent>

            {/* Realtime */}
            <TabsContent value="realtime">
              <RealtimeFeed />
            </TabsContent>

            {/* Auth */}
            <TabsContent value="auth">
              <AuthPanel currentEmail={currentEmail} />
            </TabsContent>

            {/* Export */}
            <TabsContent value="export">
              <ExportPanel />
            </TabsContent>
          </Tabs>

          <div className="mt-8 border-t border-border pt-5">
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
            >
              See how this works under the hood
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}

function BrowseTable({ rows, columns }: { rows: Row[]; columns: string[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        No rows. Insert one in the Mutate tab, or reset the demo data.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c} className="font-mono text-[12px] whitespace-nowrap">
                {c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {columns.map((c) => (
                <TableCell
                  key={c}
                  className="max-w-[24ch] truncate font-mono text-[12px]"
                  title={cellText(row[c])}
                >
                  {cellText(row[c])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PostList({ posts }: { posts: Post[] }) {
  if (posts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No posts. Insert one above.</p>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {posts.map((post) => (
        <li key={post.id} className="flex items-center justify-between gap-4 px-4 py-3">
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
              <input type="hidden" name="published" value={String(!post.published)} />
              <Button type="submit" variant="ghost" size="sm">
                {post.published ? "Unpublish" : "Publish"}
              </Button>
            </form>
            <form action={deletePostAction}>
              <input type="hidden" name="id" value={post.id} />
              <Button type="submit" variant="ghost" size="icon" aria-label="Delete post">
                <Trash2 className={cn("size-4 text-destructive")} />
              </Button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
