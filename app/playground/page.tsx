import type { Metadata } from "next";
import { getPlaygroundClient } from "@/lib/playground/client";
import { playgroundSchema } from "@/lib/playground/schema";
import { PlaygroundShell } from "@/components/playground/playground-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Playground — Fakebase",
  description:
    "A live, full-width Fakebase studio. Browse tables, run real Supabase-shaped queries, watch realtime changes stream, and export Supabase SQL + types — all against an in-memory kernel.",
};

type Row = Record<string, unknown>;
type Post = {
  id: string;
  title: string;
  body: string;
  published: boolean;
};

export default async function PlaygroundPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const { table: tableParam } = await searchParams;
  const tableNames = playgroundSchema.tables.map((t) => t.name);
  const activeTable =
    tableParam && tableNames.includes(tableParam) ? tableParam : "posts";

  const supabase = await getPlaygroundClient();

  // Active table rows (Browse). The table is a validated runtime string, so the
  // typed `.from()` overloads can't narrow it — cast at this single boundary.
  const rowsRes = await supabase.from(activeTable as never).select("*");
  const rows = (rowsRes.data ?? []) as Row[];

  // Posts for the Mutate tab (always posts, regardless of the active table).
  const postsRes = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });
  const posts = (postsRes.data ?? []) as Post[];

  const userRes = await supabase.auth.getUser();
  const currentEmail =
    (userRes.data as { user?: { email?: string } } | null)?.user?.email ?? null;

  const tables = playgroundSchema.tables.map((t) => ({
    name: t.name,
    columnCount: t.columns.length,
  }));
  const schemaTables = playgroundSchema.tables.map((t) => ({
    name: t.name,
    columns: t.columns.map((c) => c.name),
  }));
  const columns =
    playgroundSchema.tables
      .find((t) => t.name === activeTable)
      ?.columns.map((c) => c.name) ?? [];

  return (
    <PlaygroundShell
      tables={tables}
      schemaTables={schemaTables}
      activeTable={activeTable}
      rows={rows}
      columns={columns}
      posts={posts}
      currentEmail={currentEmail}
    />
  );
}
