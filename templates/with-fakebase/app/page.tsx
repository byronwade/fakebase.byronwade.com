import { supabase } from "@/lib/fakebase";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Runs on the server. The call shape is identical to @supabase/supabase-js.
  const { data: notes, error } = await supabase
    .from("notes")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main>
      <h1>Notes</h1>
      <p style={{ color: "var(--muted)" }}>
        Served from a local Fakebase in-memory adapter via a Server Component.
      </p>

      {error && <p style={{ color: "#f87171" }}>Error: {error.message}</p>}

      {notes?.map((note) => (
        <div className="note" key={note.id}>
          <strong>{note.title}</strong>
          {note.content && (
            <p style={{ color: "var(--muted)", margin: "0.5rem 0 0" }}>
              {note.content}
            </p>
          )}
          <span className="badge">{note.done ? "done" : "open"}</span>
        </div>
      ))}

      <div className="warn">
        Fakebase is local/dev-only. Run{" "}
        <code>pnpm fakebase migrate export --supabase</code> and swap to{" "}
        <code>@supabase/supabase-js</code> before shipping.
      </div>
    </main>
  );
}
