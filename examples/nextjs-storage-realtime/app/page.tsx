import { revalidatePath } from "next/cache";
import { supabase, ensureBucket, BUCKET_ID } from "@/lib/fakebase";
import { RealtimeFeed } from "./realtime-feed";

export const dynamic = "force-dynamic";

// --- Storage Server Actions ---

async function upload(formData: FormData) {
  "use server";
  await ensureBucket();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await supabase.storage.from(BUCKET_ID).upload(`${Date.now()}-${file.name}`, bytes, {
    contentType: file.type || "application/octet-stream",
  });
  revalidatePath("/");
}

async function remove(formData: FormData) {
  "use server";
  await supabase.storage.from(BUCKET_ID).remove([String(formData.get("name"))]);
  revalidatePath("/");
}

// --- Realtime Server Action: insert triggers an SSE push to all clients ---

async function emitEvent(formData: FormData) {
  "use server";
  const message = String(formData.get("message") ?? "").trim();
  if (!message) return;
  await supabase.from("events").insert({ message });
}

export default async function Home() {
  await ensureBucket();
  const { data: files } = await supabase.storage.from(BUCKET_ID).list("", {
    limit: 100,
    offset: 0,
    sortBy: { column: "created_at", order: "desc" },
  });

  return (
    <main>
      <h1>Storage &amp; Realtime</h1>

      <section>
        <h2>Storage</h2>
        <p className="muted">
          Files are written to the local filesystem under{" "}
          <code>.fakebase/storage/</code> via a Server Action.
        </p>
        <form action={upload}>
          <input type="file" name="file" required />
          <button type="submit">Upload</button>
        </form>

        {(files ?? []).map((file) => (
          <div className="row" key={file.id ?? file.name}>
            <a
              href={
                supabase.storage.from(BUCKET_ID).getPublicUrl(file.name).data.publicUrl
              }
              target="_blank"
              rel="noreferrer"
            >
              {file.name}
            </a>
            <form action={remove}>
              <input type="hidden" name="name" value={file.name} />
              <button type="submit">Delete</button>
            </form>
          </div>
        ))}
        {(!files || files.length === 0) && <p className="muted">No files yet.</p>}
      </section>

      <section>
        <h2>Realtime</h2>
        <p className="muted">
          Emitting an event inserts into <code>public.events</code>. The in-process
          realtime bus pushes it through the <code>/api/realtime</code> SSE bridge to
          every open tab.
        </p>
        <form action={emitEvent}>
          <input type="text" name="message" placeholder="Say something…" required />
          <button type="submit">Emit event</button>
        </form>
        <RealtimeFeed />
      </section>
    </main>
  );
}
