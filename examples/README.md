# Fakebase examples

Focused, copy-pasteable Next.js apps showing common Fakebase patterns. Each is **standalone** (not
part of the monorepo workspace) and depends on the published `fakebase` package, so you can copy a
folder out and run it directly.

| Example                                              | Shows                                                      |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| [`nextjs-app-router-basic`](nextjs-app-router-basic) | CRUD with Server Components + Server Actions               |
| [`nextjs-ssr-auth`](nextjs-ssr-auth)                 | Server-rendered auth (sign up / in / out) + session gating |
| [`nextjs-storage-realtime`](nextjs-storage-realtime) | File uploads + realtime over an SSE bridge                 |

```bash
cd examples/nextjs-app-router-basic
pnpm install
pnpm dev
```

For a starter you can scaffold a new project from, see
[`../templates/with-fakebase`](../templates/with-fakebase). For a single app that combines DB,
auth, and storage with a polished UI, see the live playground in
[`../apps/web`](../apps/web) (route `/playground`).

> All examples are local/dev-only. Run `fakebase migrate export --supabase` and swap to
> `@supabase/supabase-js` before shipping. See [`../docs/migration-guide.md`](../docs/migration-guide.md).
