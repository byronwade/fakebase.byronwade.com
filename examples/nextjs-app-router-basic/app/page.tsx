import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/fakebase";

export const dynamic = "force-dynamic";

// --- Server Actions: these run on the server and call Fakebase directly. ---

async function addNote(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  await supabase.from("notes").insert({ title });
  revalidatePath("/");
}

async function toggleNote(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const done = formData.get("done") === "true";
  await supabase.from("notes").update({ done: !done }).eq("id", id);
  revalidatePath("/");
}

async function deleteNote(formData: FormData) {
  "use server";
  await supabase
    .from("notes")
    .delete()
    .eq("id", String(formData.get("id")));
  revalidatePath("/");
}

export default async function Home() {
  const { data: notes, error } = await supabase
    .from("notes")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main>
      <h1>Notes</h1>
      <p style={{ color: "var(--muted)" }}>
        CRUD with Server Components + Server Actions. No API routes, no client
        JavaScript — every mutation calls <code>supabase.from(&quot;notes&quot;)</code>{" "}
        on the server.
      </p>

      <form className="add" action={addNote}>
        <input type="text" name="title" placeholder="Add a note…" required />
        <button type="submit">Add</button>
      </form>

      {error && <p style={{ color: "#f87171" }}>Error: {error.message}</p>}

      {notes?.map((note) => (
        <div className={`note${note.done ? " done" : ""}`} key={note.id}>
          <strong>{note.title}</strong>
          <span style={{ display: "flex", gap: "0.5rem" }}>
            <form action={toggleNote}>
              <input type="hidden" name="id" value={note.id} />
              <input type="hidden" name="done" value={String(note.done)} />
              <button className="link" type="submit">
                {note.done ? "Undo" : "Done"}
              </button>
            </form>
            <form action={deleteNote}>
              <input type="hidden" name="id" value={note.id} />
              <button className="link" type="submit">
                Delete
              </button>
            </form>
          </span>
        </div>
      ))}
    </main>
  );
}
