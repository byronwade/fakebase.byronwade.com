/** CORS for browser clients (dev-permissive by default). */
export type CorsOption = boolean | { origins: string[] };

export function corsHeaders(cors: CorsOption, origin: string | null): Record<string, string> {
  if (cors === false) return {};
  const allow =
    cors === true || !origin
      ? "*"
      : cors.origins.includes(origin) || cors.origins.includes("*")
        ? origin
        : cors.origins[0] ?? "*";
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD",
    "access-control-allow-headers":
      "authorization, apikey, content-type, prefer, range, accept-profile, content-profile, x-client-info",
    "access-control-expose-headers": "content-range, content-profile",
    "access-control-max-age": "86400",
  };
}

export function withCors(res: Response, cors: CorsOption, origin: string | null): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders(cors, origin))) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
