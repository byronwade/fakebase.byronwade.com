# Example: Next.js SSR Auth

Server-rendered authentication with Fakebase. Sign up / sign in / sign out run as **Server
Actions**, and the page gates its content on the **server-read session** — the same structure
you'll use with `@supabase/ssr` in production.

```bash
pnpm install
pnpm dev      # http://localhost:3000
```

## How it works

- `lib/fakebase.ts` exports a server-only `supabase` client.
- `app/page.tsx` reads the session on the server with `supabase.auth.getSession()` and renders
  either the signed-in view or the auth forms.
- The forms submit to Server Actions that call `supabase.auth.signUp` /
  `signInWithPassword` / `signOut`, then `revalidatePath("/")`.
- On sign-up, a `profiles` row is created via `supabase.from("profiles").insert(...)`.

```ts
async function signIn(formData: FormData) {
  "use server";
  await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  revalidatePath("/");
}
```

## A note on sessions & cookies

Fakebase stores sessions in a pluggable `SessionStorageAdapter`. This example uses the default
(in-process) store, which is fine for a single-user local prototype. In **production with real
Supabase**, sessions are carried in cookies — wire `@supabase/ssr`'s cookie helpers and PKCE flow.
Because the call shape is identical, only the client construction changes; your Server Actions and
session-gating logic stay the same.

For the full auth experience live in the browser, see the runnable playground in
[`apps/web`](../../apps/web) (route `/playground`), which drives sign up / in / out through
Server Actions against a per-visitor in-memory kernel.

## Capability notes

OAuth, SSO, MFA, Web3, and passkeys are capability-gated in Fakebase and throw `CapabilityError`.
Password and OTP flows are supported locally. See
[`docs/compatibility-matrix.md`](../../docs/compatibility-matrix.md).
