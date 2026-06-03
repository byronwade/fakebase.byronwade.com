/**
 * `fakebase/next` — Next.js SSR helpers.
 *
 * Mirrors the `@supabase/ssr` surface so you can swap in Fakebase for
 * local dev with a one-line change in your `utils/supabase/server.ts`:
 * ```diff
 * - import { createServerClient } from '@supabase/ssr';
 * + import { createServerClient } from 'fakebase/next';
 * ```
 *
 * Both `createServerClient` and `createBrowserClient` delegate to the same
 * underlying `createClient` from `@fakebase/client`. The distinction is
 * surface-level — the session can optionally be persisted via the provided
 * cookie helpers, but the memory kernel itself is stateless across requests
 * (sessions live in the `MemoryAuthEngine` instance for the process lifetime).
 */

import { createClient } from "@fakebase/client";
import type { FakebaseClient, FakebaseClientOptions } from "@fakebase/client";
import type { FakebaseKernel } from "@fakebase/core";

// ---------------------------------------------------------------------------
// Cookie types (mirrors @supabase/ssr)
// ---------------------------------------------------------------------------

/**
 * Cookie options passed to `set` and `remove` handlers.
 * Shape matches `@supabase/ssr` for easy migration.
 */
export interface CookieOptions {
  name?: string;
  lifetime?: number;
  domain?: string;
  path?: string;
  sameSite?: "strict" | "lax" | "none" | string;
  secure?: boolean;
  httpOnly?: boolean;
  maxAge?: number;
  expires?: Date;
}

/**
 * Cookie accessor methods passed to `createServerClient`.
 * Mirrors the `CookieMethods` interface from `@supabase/ssr`.
 */
export interface CookieMethods {
  /** Read a cookie by name. Returns `undefined` when absent. */
  get(name: string): string | undefined | Promise<string | undefined>;
  /** Set a cookie with optional options. */
  set(name: string, value: string, options: CookieOptions): void | Promise<void>;
  /** Remove a cookie with optional options. */
  remove(name: string, options: CookieOptions): void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Server helpers
// ---------------------------------------------------------------------------

/**
 * Options for `createServerClient`.
 */
export interface ServerClientOptions<
  Database = Record<string, Record<string, unknown>>,
> extends Omit<FakebaseClientOptions<Database>, "kernel"> {
  /** The kernel backing this client. Required. */
  kernel: FakebaseKernel;
  /** Cookie accessor methods for persisting the session across SSR requests. */
  cookies: CookieMethods;
}

/**
 * Create a server-side Fakebase client.
 *
 * In a real Supabase app this would read/write the session JWT from cookies.
 * In Fakebase, the memory kernel holds session state in-process, so the
 * `cookies` option is accepted for API compatibility but the session
 * persistence is transparent — no extra wiring needed for local dev.
 *
 * @example
 * ```ts
 * // app/utils/supabase/server.ts
 * import { createServerClient } from 'fakebase/next';
 * import { cookies } from 'next/headers';
 * import { kernel } from './kernel';
 *
 * export function createSupabaseServerClient() {
 *   const cookieStore = cookies();
 *   return createServerClient(
 *     process.env.NEXT_PUBLIC_SUPABASE_URL!,
 *     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
 *     {
 *       kernel,
 *       cookies: {
 *         get: (name) => cookieStore.get(name)?.value,
 *         set: (name, value, options) => cookieStore.set({ name, value, ...options }),
 *         remove: (name, options) => cookieStore.set({ name, value: '', ...options }),
 *       },
 *     },
 *   );
 * }
 * ```
 */
export function createServerClient<Database = Record<string, Record<string, unknown>>>(
  _url: string,
  _key: string,
  options: ServerClientOptions<Database>,
): FakebaseClient<Database> {
  const { cookies: _cookies, ...rest } = options;
  return createClient<Database>(_url, _key, {
    ...rest,
    auth: {
      persistSession: true,
      ...rest.auth,
    },
  });
}

// ---------------------------------------------------------------------------
// Browser helper
// ---------------------------------------------------------------------------

/**
 * Options for `createBrowserClient`.
 */
export interface BrowserClientOptions<
  Database = Record<string, Record<string, unknown>>,
> extends Omit<FakebaseClientOptions<Database>, "kernel"> {
  /** The kernel backing this client. Required. */
  kernel: FakebaseKernel;
}

/**
 * Create a browser-side Fakebase client.
 *
 * Alias for `createClient` from `@fakebase/client` — provided for API
 * symmetry with `@supabase/ssr`'s `createBrowserClient`.
 *
 * @example
 * ```ts
 * // app/utils/supabase/client.ts
 * import { createBrowserClient } from 'fakebase/next';
 * import { kernel } from './kernel';
 *
 * export const supabase = createBrowserClient(
 *   process.env.NEXT_PUBLIC_SUPABASE_URL!,
 *   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
 *   { kernel },
 * );
 * ```
 */
export function createBrowserClient<Database = Record<string, Record<string, unknown>>>(
  _url: string,
  _key: string,
  options: BrowserClientOptions<Database>,
): FakebaseClient<Database> {
  return createClient<Database>(_url, _key, options);
}
