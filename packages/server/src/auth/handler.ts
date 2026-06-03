/** /auth/v1/* — GoTrue subset (Phase 1: password, session, user, logout). */
import type { FakebaseKernel } from "@byronwade/core";
import type { AuthSession, AuthUser } from "@byronwade/core";
import { signJwt } from "./jwt.js";
import { errorJson } from "../errors.js";
import type { AuthConfig } from "../context.js";

/** Replace the engine's opaque access_token with a decodable HS256 JWT. */
function withJwt(session: AuthSession, cfg: AuthConfig): AuthSession & { user: AuthUser } {
  const access_token = signJwt(
    { sub: session.user.id, role: "authenticated", email: session.user.email },
    cfg.jwtSecret,
    { expiresIn: session.expires_in },
  );
  return { ...session, access_token };
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function handleAuth(
  req: Request,
  url: URL,
  kernel: FakebaseKernel,
  cfg: AuthConfig,
): Promise<Response> {
  const path = url.pathname.replace(/^\/auth\/v1/, "");
  const auth = kernel.auth;

  // POST /signup
  if (path === "/signup" && req.method === "POST") {
    const { email, password } = await readBody(req);
    const r = await auth.signUp({ email: String(email), password: String(password) });
    if (r.error) return errorJson(400, { message: r.error.message });
    if (!r.data.session) {
      // email-confirmation flow — return the user without a session
      return json(200, { user: r.data.user, session: null });
    }
    return json(200, withJwt(r.data.session, cfg));
  }

  // POST /token?grant_type=password | refresh_token
  if (path === "/token" && req.method === "POST") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      const { email, password } = await readBody(req);
      const r = await auth.signInWithPassword({ email: String(email), password: String(password) });
      if (r.error || !r.data.session)
        return errorJson(400, { message: r.error?.message ?? "Invalid login credentials", code: "invalid_grant" });
      return json(200, withJwt(r.data.session, cfg));
    }
    return errorJson(400, { message: `Unsupported grant_type: ${grant}`, code: "unsupported_grant_type" });
  }

  // GET /user  (Bearer JWT)
  if (path === "/user" && req.method === "GET") {
    const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
    const { verifyJwt } = await import("./jwt.js");
    const claims = token ? verifyJwt(token, cfg.jwtSecret) : null;
    if (!claims?.sub) return errorJson(401, { message: "invalid claim: missing sub", code: "bad_jwt" });
    const r = await auth.admin.getUserById(String(claims.sub));
    if (r.error || !r.data.user) return errorJson(404, { message: "User not found" });
    return json(200, r.data.user);
  }

  // POST /logout
  if (path === "/logout" && req.method === "POST") {
    await auth.signOut();
    return new Response(null, { status: 204 });
  }

  return errorJson(404, { message: `No auth route: ${req.method} ${path}` });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
