/**
 * Minimal HS256 JWT sign/verify using `node:crypto` — no dependencies.
 *
 * Issued as the GoTrue `access_token` so `@supabase/supabase-js` can decode the
 * user/expiry locally and forward it as a Bearer token. This is a dev-only
 * signer; it is not a security boundary.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type JwtClaims = Record<string, unknown> & {
  sub?: string;
  role?: string;
  email?: string;
  iat?: number;
  exp?: number;
};

const b64url = (input: string | Buffer): string =>
  Buffer.from(input).toString("base64url");

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

/** Seconds since epoch; injectable for deterministic tests. */
function nowSeconds(now?: number): number {
  return now ?? Math.floor(Date.now() / 1000);
}

export function signJwt(
  claims: JwtClaims,
  secret: string,
  options: { expiresIn?: number; now?: number } = {},
): string {
  const iat = nowSeconds(options.now);
  const payload: JwtClaims = { iat, ...claims };
  if (options.expiresIn !== undefined) payload.exp = iat + options.expiresIn;
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const signature = sign(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

export function verifyJwt(
  token: string,
  secret: string,
  options: { now?: number } = {},
): JwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts as [string, string, string];

  const expected = sign(`${header}.${body}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let claims: JwtClaims;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as JwtClaims;
  } catch {
    return null;
  }

  if (typeof claims.exp === "number" && nowSeconds(options.now) >= claims.exp) {
    return null;
  }
  return claims;
}
