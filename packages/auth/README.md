# `@byronwade/auth`

> Part of [**Fakebase**](https://github.com/byronwade/fakebase) — a Supabase-shaped, **local/dev-only** development platform for Next.js prototypes. Not for production use.

The local auth engine — email/password, OTP, PKCE, and pluggable session storage. It mirrors the `supabase.auth` surface and backs the `db.auth` facade.

## Installation

```bash
pnpm add fakebase
```

This package ships with `fakebase` and is published as `@byronwade/auth`.

## Usage

```ts
import { LocalAuthService, MemorySessionStorage } from "@byronwade/auth";

const auth = new LocalAuthService(new Map(), new Map(), new MemorySessionStorage());

await auth.signUp({ email: "dev@example.com", password: "password" });
const result = await auth.signInWithPassword({
  email: "dev@example.com",
  password: "password",
});
```

## What's inside

- `LocalAuthService` — `signUp`, `signInWithPassword`, `signInWithOtp`, `verifyOtp`, and more (+ `LocalAuthServiceOptions`).
- Session storage adapters: `MemorySessionStorage`, `CookieSessionStorage` (SSR), `LocalStorageSessionStorage`.
- PKCE helpers: `generateCodeVerifier`, `generateCodeChallenge`, `generateAuthCode`, `PkceStore`.
- Types: `LocalUser`, `LocalSession`, `AuthStateChangeEvent`, `OtpRecord`, `SessionStorageAdapter`.

Dev-only — credentials and OTP codes are handled locally and are **not** production-grade. OTPs land in a local inbox instead of real email/SMS.

## Documentation

- [Project README](https://github.com/byronwade/fakebase#readme)
- [Architecture](https://github.com/byronwade/fakebase/blob/main/docs/architecture.md)
- [Compatibility matrix](https://github.com/byronwade/fakebase/blob/main/docs/compatibility-matrix.md)

## License

MIT
