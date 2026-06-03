import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/fakebase";

export const dynamic = "force-dynamic";

// --- Server Actions: auth runs entirely on the server. ---

async function signUp(formData: FormData) {
  "use server";
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (!error && data?.user) {
    // Create an application profile row for the new user.
    await supabase
      .from("profiles")
      .insert({ user_id: data.user.id, email: data.user.email });
  }
  revalidatePath("/");
}

async function signIn(formData: FormData) {
  "use server";
  await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  revalidatePath("/");
}

async function signOut() {
  "use server";
  await supabase.auth.signOut();
  revalidatePath("/");
}

export default async function Home() {
  // Server-rendered session gating — read the session on the server.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    return (
      <main>
        <h1>Welcome back</h1>
        <div className="session">
          <p>
            Signed in as <strong>{session.user.email}</strong>
          </p>
          <p className="muted">User ID: {session.user.id}</p>
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main>
      <h1>Sign in</h1>
      <p className="muted">
        Auth runs server-side via <code>supabase.auth.*</code>. Try{" "}
        <code>dev@example.com</code> / <code>password123</code> (sign up first).
      </p>

      <form action={signIn}>
        <strong>Sign in</strong>
        <input type="email" name="email" placeholder="email" required />
        <input type="password" name="password" placeholder="password" required />
        <button type="submit">Sign in</button>
      </form>

      <form action={signUp}>
        <strong>Create account</strong>
        <input type="email" name="email" placeholder="email" required />
        <input type="password" name="password" placeholder="password" required />
        <button type="submit">Sign up</button>
      </form>
    </main>
  );
}
