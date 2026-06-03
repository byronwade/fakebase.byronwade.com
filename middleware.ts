import { NextResponse, type NextRequest } from "next/server";
import { PLAYGROUND_COOKIE } from "@/lib/playground/cookie";

/** Ensure every /playground visitor has a sandbox id cookie so their in-memory
 *  Fakebase data and auth session stay isolated to them. */
export function middleware(request: NextRequest) {
  const existing = request.cookies.get(PLAYGROUND_COOKIE)?.value;
  const id = existing ?? crypto.randomUUID();

  // Set it on the *request* too, so the very first render already resolves this
  // visitor's own sandbox (not the shared "anon" fallback) before the browser
  // has stored the cookie.
  if (!existing) request.cookies.set(PLAYGROUND_COOKIE, id);

  const res = NextResponse.next({ request: { headers: request.headers } });
  if (!existing) {
    res.cookies.set(PLAYGROUND_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day
    });
  }
  return res;
}

export const config = {
  matcher: ["/playground/:path*", "/playground"],
};
