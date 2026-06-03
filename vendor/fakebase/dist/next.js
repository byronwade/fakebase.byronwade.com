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
export function createServerClient(_url, _key, options) {
    const { cookies: _cookies, ...rest } = options;
    return createClient(_url, _key, {
        ...rest,
        auth: {
            persistSession: true,
            ...rest.auth,
        },
    });
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
export function createBrowserClient(_url, _key, options) {
    return createClient(_url, _key, options);
}
//# sourceMappingURL=next.js.map