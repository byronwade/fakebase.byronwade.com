/** Resolve a request's RLS role context from its auth headers. */
import type { RoleContext } from "@byronwade/core";
import { verifyJwt } from "./auth/jwt.js";

export interface AuthConfig {
  anonKey: string;
  serviceKey: string;
  jwtSecret: string;
}

function bearer(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (!auth) return null;
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m ? m[1]! : null;
}

export function resolveRole(headers: Headers, cfg: AuthConfig): RoleContext {
  const apikey = headers.get("apikey");
  const token = bearer(headers);

  // A valid user JWT → authenticated, with claims for auth.uid()/auth.role().
  if (token) {
    const claims = verifyJwt(token, cfg.jwtSecret);
    if (claims) {
      return {
        role: (claims.role as RoleContext["role"]) ?? "authenticated",
        userId: typeof claims.sub === "string" ? claims.sub : undefined,
        claims,
      };
    }
  }
  // Service key (header or bearer) bypasses RLS.
  if (apikey === cfg.serviceKey || token === cfg.serviceKey) return { role: "service_role" };
  // Anything else (incl. the anon key) is anon.
  return { role: "anon" };
}
